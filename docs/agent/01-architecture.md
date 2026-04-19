# Architecture Overview

## Package Structure

```
packages/
  scene-api/          # Pure typed domain API over scene state
  agent-core/         # Planner, executor, runtime, tools, resolver
  agent-models/        # Provider abstractions (mock, ollama, openai-compatible)
  agent-testkit/       # Fixtures, scenario harnesses, matchers
apps/
  cli/                 # Headless CLI (pascal-agent)
```

## Data Flow

```
User Request
     ↓
  CLI / Editor Panel
     ↓
  Planner (creates Plan from request)
     ↓
  TaskRunner (orchestrates execution)
     ↓
  Executor (runs Plan steps via ToolRegistry)
     ↓
  Tools (scene.summary, wall.inspect, wall.simulate_change, etc.)
     ↓
  SceneApi (pure stateless API over scene data)
     ↓
  Impact Engine (checks connected walls, openings, zones)
     ↓
  Validation → Result returned to user
```

## Provider Fallback Chain

```
1. Try configured provider (Ollama / OpenAI-compatible)
2. If unavailable, try Ollama local
3. If unavailable, fall back to mock provider
4. Log diagnostic at each step
```

## Key Principles

- **No React**: SceneApi and agent-core are pure TypeScript, no React dependencies
- **Dry-run first**: All mutation tools support dry-run before apply
- **Impact awareness**: Every wall change returns impact on ALL affected walls
- **Fallback resilience**: If AI provider is unavailable, mock provides deterministic responses
- **Testability**: All packages are fully testable with pure fixtures