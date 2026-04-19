import { ProviderType } from '../types'
import type { ProviderConfig } from './provider-config'

/**
 * Load provider configuration from environment variables.
 *
 * Supported env vars:
 * - AGENT_PROVIDER: 'mock' | 'ollama' | 'openai-compatible'
 * - AGENT_MODEL: model name
 * - AGENT_BASE_URL: base URL for the provider
 * - AGENT_API_KEY: API key (for openai-compatible)
 * - AGENT_TIMEOUT: timeout in ms
 * - OLLAMA_BASE_URL: alias for AGENT_BASE_URL when using ollama
 * - OPENAI_API_KEY: alias for AGENT_API_KEY when using openai-compatible
 */
export function loadConfigFromEnv(
  env: Record<string, string | undefined> = {} as Record<string, string | undefined>,
): ProviderConfig {
  const providerType = (env.AGENT_PROVIDER ?? 'mock') as ProviderType
  const model = env.AGENT_MODEL
  const baseUrl = env.AGENT_BASE_URL ?? env.OLLAMA_BASE_URL
  const apiKey = env.AGENT_API_KEY ?? env.OPENAI_API_KEY
  const timeout = env.AGENT_TIMEOUT ? parseInt(env.AGENT_TIMEOUT, 10) : undefined

  const mainConfig: ProviderConfig = {
    default: {
      type: providerType,
      model,
      baseUrl,
      apiKey,
      timeout,
    },
  }

  // Always include mock as fallback
  mainConfig.mock = {
    type: ProviderType.Mock,
  }

  // If main isn't ollama, offer ollama as secondary fallback
  if (providerType !== ProviderType.Ollama) {
    mainConfig.ollama = {
      type: ProviderType.Ollama,
      baseUrl: env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: model ?? 'qwen2.5-coder',
    }
  }

  return mainConfig
}
