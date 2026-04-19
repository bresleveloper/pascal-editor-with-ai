import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ProviderHealth,
  ProviderStatus,
  ProviderType,
} from '../types'

/**
 * Mock provider for deterministic testing and CI.
 * Returns predefined responses based on simple pattern matching,
 * or a default response if no pattern matches.
 */
export class MockProvider implements ModelProvider {
  readonly name: string
  readonly type = ProviderType.Mock
  readonly supportsTools = true
  readonly supportsJson = true

  private responses: Map<string, string> = new Map()
  private defaultResponse: string
  private healthStatus: ProviderHealth = {
    status: ProviderStatus.Healthy,
    message: 'Mock provider is always healthy',
  }

  constructor(name = 'mock', defaultResponse = 'Mock response') {
    this.name = name
    this.defaultResponse = defaultResponse
  }

  /**
   * Register a response for a given prompt pattern.
   * The pattern is matched as a substring of the last user message.
   */
  registerResponse(pattern: string, response: string): this {
    this.responses.set(pattern, response)
    return this
  }

  /**
   * Set the health status for testing.
   */
  setHealthStatus(status: ProviderStatus, message?: string): this {
    this.healthStatus = { status, message: message ?? `Mock provider status: ${status}` }
    return this
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      status: this.healthStatus.status,
      message: this.healthStatus.message,
    }
  }

  async complete(input: ModelRequest): Promise<ModelResponse> {
    // Find the last user message
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user')

    const content = lastUserMessage?.content ?? ''

    // Pattern match
    let response = this.defaultResponse
    for (const [pattern, resp] of this.responses) {
      if (content.includes(pattern)) {
        response = resp
        break
      }
    }

    return {
      content: response,
      model: input.model ?? 'mock-model',
      provider: this.name,
      finishReason: 'stop',
      usage: {
        promptTokens: input.messages.reduce((acc, m) => acc + m.content.length, 0),
        completionTokens: response.length,
        totalTokens: input.messages.reduce((acc, m) => acc + m.content.length, 0) + response.length,
      },
    }
  }
}
