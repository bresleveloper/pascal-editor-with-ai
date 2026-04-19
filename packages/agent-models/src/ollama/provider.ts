import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ProviderHealth,
  ProviderStatus,
  ProviderType,
} from '../types'

/**
 * Ollama provider for local model inference.
 * Connects to a local Ollama server using its chat/completions API.
 */
export class OllamaProvider implements ModelProvider {
  readonly name: string
  readonly type = ProviderType.Ollama
  readonly supportsTools = true
  readonly supportsJson = true

  private baseUrl: string
  private modelName: string
  private timeout: number

  constructor(
    options: {
      name?: string
      baseUrl?: string
      model?: string
      timeout?: number
    } = {},
  ) {
    this.name = options.name ?? 'ollama'
    this.baseUrl = options.baseUrl ?? 'http://localhost:11434'
    this.modelName = options.model ?? 'qwen2.5-coder'
    this.timeout = options.timeout ?? 120_000
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const start = Date.now()
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      const latencyMs = Date.now() - start

      if (response.ok) {
        const data = (await response.json()) as { models: { name: string }[] }
        const hasModel = data.models?.some((m) => m.name === this.modelName)
        return {
          status: hasModel ? ProviderStatus.Healthy : ProviderStatus.Degraded,
          latencyMs,
          message: hasModel
            ? `Ollama is running and ${this.modelName} is available`
            : `Ollama is running but ${this.modelName} is not found. Available: ${data.models?.map((m) => m.name).join(', ') ?? 'none'}`,
        }
      }
      return {
        status: ProviderStatus.Unavailable,
        latencyMs,
        message: `Ollama returned status ${response.status}`,
      }
    } catch (error) {
      return {
        status: ProviderStatus.Unavailable,
        message: `Cannot connect to Ollama at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async complete(input: ModelRequest): Promise<ModelResponse> {
    const start = Date.now()

    const ollamaMessages = input.messages.map((m) => {
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
        }
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }
    })

    const body: Record<string, unknown> = {
      model: input.model ?? this.modelName,
      messages: ollamaMessages,
      stream: false,
    }

    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
    }

    if (input.responseFormat?.type === 'json') {
      body.format = 'json'
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Ollama request failed (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as {
      message: {
        content: string
        tool_calls?: Array<{ function: { name: string; arguments: string } }>
      }
      model: string
      eval_count?: number
      prompt_eval_count?: number
      done_reason?: string
    }

    const toolCalls = data.message?.tool_calls?.map((tc, i) => ({
      id: `tool_${i}`,
      name: tc.function.name,
      arguments:
        typeof tc.function.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function.arguments),
    }))

    return {
      content: data.message?.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      model: data.model ?? this.modelName,
      provider: this.name,
      finishReason: toolCalls?.length
        ? 'tool_call'
        : data.done_reason === 'length'
          ? 'length'
          : 'stop',
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    }
  }

  get model(): string {
    return this.modelName
  }

  get url(): string {
    return this.baseUrl
  }
}
