import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ModelToolCall,
  type ProviderHealth,
  ProviderStatus,
  ProviderType,
} from '../types'

/**
 * OpenAI-compatible provider for any API that exposes the chat/completions endpoint.
 * Works with OpenAI, Together, Groq, etc.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: string
  readonly type = ProviderType.OpenAICompatible
  readonly supportsTools = true
  readonly supportsJson = true

  private baseUrl: string
  private modelName: string
  private apiKey: string
  private timeout: number

  constructor(
    options: {
      name?: string
      baseUrl?: string
      model?: string
      apiKey?: string
      timeout?: number
    } = {},
  ) {
    this.name = options.name ?? 'openai-compatible'
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    this.modelName = options.model ?? 'gpt-4o'
    this.apiKey = options.apiKey ?? ''
    this.timeout = options.timeout ?? 120_000
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.apiKey) {
      return {
        status: ProviderStatus.Unavailable,
        message: 'No API key configured',
      }
    }

    try {
      const start = Date.now()
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })
      const latencyMs = Date.now() - start

      if (response.ok) {
        return {
          status: ProviderStatus.Healthy,
          latencyMs,
          message: `OpenAI-compatible API is reachable at ${this.baseUrl}`,
        }
      }
      return {
        status: ProviderStatus.Unavailable,
        latencyMs,
        message: `API returned status ${response.status}`,
      }
    } catch (error) {
      return {
        status: ProviderStatus.Unavailable,
        message: `Cannot reach API at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async complete(input: ModelRequest): Promise<ModelResponse> {
    if (!this.apiKey) {
      throw new Error('No API key configured for OpenAI-compatible provider')
    }

    const openaiMessages = input.messages.map((m) => {
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
        }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        }
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }
    })

    const body: Record<string, unknown> = {
      model: input.model ?? this.modelName,
      messages: openaiMessages,
    }

    if (input.temperature !== undefined) {
      body.temperature = input.temperature
    }
    if (input.maxTokens !== undefined) {
      body.max_tokens = input.maxTokens
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
      body.response_format = { type: 'json_object' }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`OpenAI-compatible request failed (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{
            id: string
            function: { name: string; arguments: string }
          }>
        }
        finish_reason: string
      }>
      model: string
      usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }

    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('No choices returned from API')
    }

    const toolCalls: ModelToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }))

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      model: data.model ?? this.modelName,
      provider: this.name,
      finishReason:
        choice.finish_reason === 'tool_calls'
          ? 'tool_call'
          : choice.finish_reason === 'length'
            ? 'length'
            : 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
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
