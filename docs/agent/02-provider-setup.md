# Provider Setup

## Default: Mock Provider (No setup needed)

The mock provider works out of the box for CI, tests, and offline development.

```bash
AGENT_PROVIDER=mock pascal-agent ask "inspect the north wall"
```

## Ollama (Local AI)

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull qwen2.5-coder`
3. Run the agent:

```bash
AGENT_PROVIDER=ollama pascal-agent ask "move the kitchen wall out 40cm" --dry-run
```

Configuration:
- `AGENT_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://localhost:11434` (default)
- `AGENT_MODEL=qwen2.5-coder` (default)

## OpenAI-Compatible (Remote AI)

```bash
AGENT_PROVIDER=openai-compatible \
AGENT_API_KEY=sk-xxx \
AGENT_BASE_URL=https://api.openai.com/v1 \
AGENT_MODEL=gpt-4o \
pascal-agent ask "add a window to the kitchen wall"
```

## Configuration File

Create `agent.config.ts`:

```ts
import { ProviderType } from '@pascal/agent-models'

export default {
  default: {
    type: ProviderType.Ollama,
    model: 'qwen2.5-coder',
  },
  mock: {
    type: ProviderType.Mock,
  },
  ollama: {
    type: ProviderType.Ollama,
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5-coder',
  },
}
```

## Fallback Behavior

At startup:
1. Try configured provider
2. If unavailable, try Ollama local
3. If unavailable, fall back to mock
4. Emit a diagnostic log at each step