import { ProviderType } from '@pascal/agent-models'

export default {
  default: {
    type: ProviderType.Ollama,
    model: 'qwen2.5-coder',
    baseUrl: 'http://localhost:11434',
  },
}