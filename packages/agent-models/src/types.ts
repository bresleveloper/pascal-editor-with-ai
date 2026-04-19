/**
 * Core types for model providers.
 */

export enum ProviderStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unavailable = 'unavailable',
}

export enum ProviderType {
  Mock = 'mock',
  Ollama = 'ollama',
  OpenAICompatible = 'openai-compatible',
}

export interface ProviderHealth {
  status: ProviderStatus
  latencyMs?: number
  message?: string
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ModelToolCall[]
}

export interface ModelToolCall {
  id: string
  name: string
  arguments: string // JSON string
}

export interface ModelRequest {
  messages: ModelMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  responseFormat?: { type: 'json' | 'text' }
}

export interface ModelResponse {
  content: string
  toolCalls?: ModelToolCall[]
  model: string
  provider: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'tool_call' | 'length' | 'error'
}

export interface ModelChunk {
  content?: string
  toolCalls?: Partial<ModelToolCall>[]
  finishReason?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface ModelProvider {
  readonly name: string
  readonly type: ProviderType
  healthCheck(): Promise<ProviderHealth>
  complete(input: ModelRequest): Promise<ModelResponse>
  stream?(input: ModelRequest): AsyncIterable<ModelChunk>
  readonly supportsTools: boolean
  readonly supportsJson: boolean
}
