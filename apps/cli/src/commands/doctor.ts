/**
 * Doctor — check agent health, providers, and configuration.
 */

import {
  loadConfigFromEnv,
  MockProvider,
  OllamaProvider,
  ProviderStatus,
} from '@pascal/agent-models'

export async function doctor(options: { json?: boolean }) {
  const results: Record<string, unknown> = {}

  // 1. Check mock provider
  const mock = new MockProvider('mock')
  const mockHealth = await mock.healthCheck()
  results.mock = {
    status: mockHealth.status,
    message: mockHealth.message,
  }

  // 2. Check Ollama
  const ollama = new OllamaProvider()
  const ollamaHealth = await ollama.healthCheck()
  results.ollama = {
    status: ollamaHealth.status,
    message: ollamaHealth.message,
    latency: ollamaHealth.latencyMs,
  }

  // 3. Check config
  const config = loadConfigFromEnv()
  results.config = {
    defaultProvider: config.default?.type,
    providers: Object.keys(config),
  }

  // 4. Summary
  const healthy = mockHealth.status !== ProviderStatus.Unavailable
  results.overall = healthy ? 'healthy' : 'degraded'

  if (options.json) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    console.log('🏥 Pascal Agent Doctor')
    console.log('')
    console.log(`Mock Provider:  ${statusIcon(mockHealth.status)} ${mockHealth.message}`)
    console.log(`Ollama:         ${statusIcon(ollamaHealth.status)} ${ollamaHealth.message}`)
    if (ollamaHealth.latencyMs !== undefined) {
      console.log(`               Latency: ${ollamaHealth.latencyMs}ms`)
    }
    console.log(
      `Config:        Default=${config.default?.type}, Providers=${Object.keys(config).join(', ')}`,
    )
    console.log('')
    console.log(`Overall: ${healthy ? '✅ Healthy' : '⚠️ Degraded (mock fallback available)'}`)
  }
}

function statusIcon(status: string): string {
  if (status === 'healthy') return '✅'
  if (status === 'degraded') return '⚠️'
  return '❌'
}
