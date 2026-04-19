import { describe, expect, test } from 'bun:test'
import { loadConfigFromEnv } from '../config/env-config'
import { createRegistryFromConfig, ProviderRegistry } from '../config/provider-config'
import { MockProvider } from '../mock/provider'
import { OllamaProvider } from '../ollama/provider'
import { OpenAICompatibleProvider } from '../openai-compatible/provider'
import { ProviderStatus, ProviderType } from '../types'

describe('agent-models', () => {
  describe('MockProvider', () => {
    test('returns default response', async () => {
      const provider = new MockProvider()
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(response.content).toBe('Mock response')
      expect(response.provider).toBe('mock')
      expect(response.finishReason).toBe('stop')
    })

    test('returns pattern-matched response', async () => {
      const provider = new MockProvider().registerResponse('kitchen', 'Found kitchen walls')

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Show me the kitchen walls' }],
      })

      expect(response.content).toBe('Found kitchen walls')
    })

    test('health check returns healthy', async () => {
      const provider = new MockProvider()
      const health = await provider.healthCheck()

      expect(health.status).not.toBe(ProviderStatus.Unavailable)
    })

    test('supports custom health status', async () => {
      const provider = new MockProvider()
      provider.setHealthStatus(ProviderStatus.Unavailable, 'Testing unavailable state')

      const health = await provider.healthCheck()
      expect(health.status).toBe(ProviderStatus.Unavailable)
    })

    test('returns usage stats', async () => {
      const provider = new MockProvider()
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello world' }],
      })

      expect(response.usage).toBeDefined()
      expect(response.usage?.promptTokens).toBeGreaterThan(0)
      expect(response.usage?.completionTokens).toBeGreaterThan(0)
    })
  })

  describe('OllamaProvider', () => {
    test('creates with defaults', () => {
      const provider = new OllamaProvider()
      expect(provider.name).toBe('ollama')
      expect(provider.type).toBe(ProviderType.Ollama)
      expect(provider.model).toBe('qwen2.5-coder')
    })

    test('creates with custom options', () => {
      const provider = new OllamaProvider({
        name: 'my-ollama',
        baseUrl: 'http://custom:11434',
        model: 'llama3',
      })
      expect(provider.name).toBe('my-ollama')
      expect(provider.url).toBe('http://custom:11434')
      expect(provider.model).toBe('llama3')
    })

    test('health check returns unavailable when not running', async () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:19999', // unlikely to be running
      })
      const health = await provider.healthCheck()
      expect(health.status).toBe(ProviderStatus.Unavailable)
    })
  })

  describe('OpenAICompatibleProvider', () => {
    test('creates with defaults', () => {
      const provider = new OpenAICompatibleProvider()
      expect(provider.name).toBe('openai-compatible')
      expect(provider.type).toBe(ProviderType.OpenAICompatible)
    })

    test('health check returns unavailable without API key', async () => {
      const provider = new OpenAICompatibleProvider({ apiKey: '' })
      const health = await provider.healthCheck()
      expect(health.status).toBe(ProviderStatus.Unavailable)
    })
  })

  describe('ProviderRegistry', () => {
    test('registers and retrieves providers', () => {
      const registry = new ProviderRegistry()
      const mock = new MockProvider('test')
      registry.register(mock)

      expect(registry.get('test')).toBe(mock)
      expect(registry.list()).toContain('test')
    })

    test('sets default provider', () => {
      const registry = new ProviderRegistry()
      const mock = new MockProvider('test')
      registry.register(mock, true)

      expect(registry.getDefault()).toBe(mock)
    })

    test('resolveWithFallback returns mock when others unavailable', async () => {
      const registry = new ProviderRegistry()
      const mock = new MockProvider('fallback-mock')
      registry.register(new OllamaProvider({ baseUrl: 'http://localhost:19999' }))
      registry.register(mock)

      const provider = await registry.resolveWithFallback()
      expect(provider.name).toBe('fallback-mock')
    })
  })

  describe('createRegistryFromConfig', () => {
    test('creates registry from config', () => {
      const registry = createRegistryFromConfig({
        mock: { type: ProviderType.Mock },
        ollama: { type: ProviderType.Ollama, model: 'llama3' },
      })

      expect(registry.list()).toContain('mock')
      expect(registry.list()).toContain('ollama')
    })
  })

  describe('loadConfigFromEnv', () => {
    test('loads mock provider by default', () => {
      const config = loadConfigFromEnv({})
      expect(config.default.type).toBe(ProviderType.Mock)
    })

    test('loads ollama provider', () => {
      const config = loadConfigFromEnv({ AGENT_PROVIDER: 'ollama' })
      expect(config.default.type).toBe(ProviderType.Ollama)
    })

    test('always includes mock fallback', () => {
      const config = loadConfigFromEnv({ AGENT_PROVIDER: 'ollama' })
      expect(config.mock).toBeDefined()
      expect(config.mock.type).toBe(ProviderType.Mock)
    })
  })
})
