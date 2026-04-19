/**
 * @pascal/agent-models
 * Provider abstractions and implementations for AI model access.
 */

export { loadConfigFromEnv } from './config/env-config'
export type { ProviderConfig, ProviderConfigEntry } from './config/provider-config'
// Config
export { createRegistryFromConfig, ProviderRegistry } from './config/provider-config'
// Provider implementations
export { MockProvider } from './mock/provider'
export { OllamaProvider } from './ollama/provider'
export { OpenAICompatibleProvider } from './openai-compatible/provider'
// Convenience
export { resolveProvider } from './resolve'
export type {
  ModelChunk,
  ModelMessage,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelToolCall,
  ProviderHealth,
  ToolDefinition,
} from './types'
// Provider types
export { ProviderStatus, ProviderType } from './types'
