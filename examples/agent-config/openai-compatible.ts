import { ProviderType } from '@pascal/agent-models'

export default {
  default: {
    type: ProviderType.OpenAICompatible,
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY ?? '',
  },
}