/**
 * Models — list and test model providers.
 */

import { MockProvider, OllamaProvider, OpenAICompatibleProvider } from '@pascal/agent-models'

export async function models(
  action: 'list' | 'test',
  options: { provider?: string; json?: boolean },
) {
  if (action === 'list') {
    const providers = [
      { name: 'mock', type: 'mock', description: 'Deterministic mock for testing and CI' },
      {
        name: 'ollama',
        type: 'ollama',
        description: 'Local Ollama provider (default: qwen2.5-coder)',
      },
      { name: 'openai', type: 'openai-compatible', description: 'Any OpenAI-compatible API' },
    ]

    if (options.json) {
      console.log(JSON.stringify(providers, null, 2))
    } else {
      console.log('📋 Available Model Providers:')
      for (const p of providers) {
        console.log(`  ${p.name} (${p.type}): ${p.description}`)
      }
    }
    return
  }

  if (action === 'test') {
    const providerName = options.provider ?? 'mock'

    if (options.json) {
      console.log(JSON.stringify({ testing: providerName }))
    } else {
      console.log(`🧪 Testing provider: ${providerName}`)
    }

    let provider: { healthCheck: () => Promise<unknown>; name: string }
    switch (providerName) {
      case 'mock':
        provider = new MockProvider('test-mock')
        break
      case 'ollama':
        provider = new OllamaProvider()
        break
      case 'openai':
        provider = new OpenAICompatibleProvider()
        break
      default:
        console.error(`Unknown provider: ${providerName}`)
        process.exit(1)
    }

    const health = await provider.healthCheck()

    if (options.json) {
      console.log(JSON.stringify({ provider: providerName, health }))
    } else {
      console.log(`  Result: ${JSON.stringify(health)}`)
    }
  }
}
