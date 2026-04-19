import { MockProvider } from '../mock/provider'
import { OllamaProvider } from '../ollama/provider'
import { OpenAICompatibleProvider } from '../openai-compatible/provider'
import type { ModelProvider } from '../types'
import { ProviderStatus, ProviderType } from '../types'

export interface ProviderConfigEntry {
  type: ProviderType
  name?: string
  baseUrl?: string
  model?: string
  apiKey?: string
  timeout?: number
}

export type ProviderConfig = Record<string, ProviderConfigEntry>

/**
 * Registry of model providers. Supports lookup by name and fallback ordering.
 */
export class ProviderRegistry {
  private providers = new Map<string, ModelProvider>()
  private defaultProviderName: string | null = null

  register(provider: ModelProvider, setDefault = false): this {
    this.providers.set(provider.name, provider)
    if (setDefault || this.providers.size === 1) {
      this.defaultProviderName = provider.name
    }
    return this
  }

  get(name: string): ModelProvider | undefined {
    return this.providers.get(name)
  }

  getDefault(): ModelProvider | undefined {
    if (!this.defaultProviderName) return undefined
    return this.providers.get(this.defaultProviderName)
  }

  setDefault(name: string): this {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not found in registry`)
    }
    this.defaultProviderName = name
    return this
  }

  list(): string[] {
    return [...this.providers.keys()]
  }

  /**
   * Resolve a provider with fallback:
   * 1. Try the named provider (or default)
   * 2. Try Ollama local if available
   * 3. Fall back to mock provider
   */
  async resolveWithFallback(name?: string): Promise<ModelProvider> {
    const target = name ? this.providers.get(name) : this.getDefault()

    if (target) {
      const health = await target.healthCheck()
      if (health.status !== ProviderStatus.Unavailable) {
        return target
      }
    }

    // Try Ollama as fallback
    const ollama = this.providers.get('ollama')
    if (ollama) {
      const health = await ollama.healthCheck()
      if (health.status !== ProviderStatus.Unavailable) {
        return ollama
      }
    }

    // Fall back to mock
    const mock = this.providers.get('mock')
    if (mock) return mock

    // Create an ad-hoc mock
    return new MockProvider('fallback-mock', 'No provider available — using mock fallback')
  }
}

/**
 * Create a provider registry from a configuration object.
 */
export function createRegistryFromConfig(config: ProviderConfig): ProviderRegistry {
  const registry = new ProviderRegistry()

  for (const [name, entry] of Object.entries(config)) {
    switch (entry.type) {
      case ProviderType.Mock:
        registry.register(new MockProvider(name))
        break
      case ProviderType.Ollama:
        registry.register(
          new OllamaProvider({
            name,
            baseUrl: entry.baseUrl,
            model: entry.model,
            timeout: entry.timeout,
          }),
        )
        break
      case ProviderType.OpenAICompatible:
        registry.register(
          new OpenAICompatibleProvider({
            name,
            baseUrl: entry.baseUrl,
            model: entry.model,
            apiKey: entry.apiKey,
            timeout: entry.timeout,
          }),
        )
        break
    }
  }

  return registry
}
