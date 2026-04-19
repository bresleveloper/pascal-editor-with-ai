import { MockProvider } from './mock/provider'
import { OllamaProvider } from './ollama/provider'
import { OpenAICompatibleProvider } from './openai-compatible/provider'
import type { ModelProvider } from './types'
import { ProviderType } from './types'

/**
 * Resolve a provider by type, creating a default instance.
 */
export function resolveProvider(
  type: ProviderType,
  options?: { baseUrl?: string; model?: string; apiKey?: string },
): ModelProvider {
  switch (type) {
    case ProviderType.Mock:
      return new MockProvider()
    case ProviderType.Ollama:
      return new OllamaProvider({
        baseUrl: options?.baseUrl,
        model: options?.model,
      })
    case ProviderType.OpenAICompatible:
      return new OpenAICompatibleProvider({
        baseUrl: options?.baseUrl,
        model: options?.model,
        apiKey: options?.apiKey,
      })
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}
