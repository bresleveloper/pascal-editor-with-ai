# Testing

## Running Tests

Each package has its own test suite:

```bash
# Scene API tests
cd packages/scene-api && bun test src/__tests__/scene-api.test.ts

# Agent Models tests
cd packages/agent-models && bun test src/__tests__/agent-models.test.ts

# Agent Core tests
cd packages/agent-core && bun test src/__tests__/agent-core.test.ts
```

## Test Coverage

- **scene-api** (24 tests): Queries, mutations, impact analysis, validation, diff, fixtures
- **agent-models** (17 tests): Mock provider, Ollama provider, OpenAI provider, config, registry
- **agent-core** (25 tests): TaskRunner, RetryPolicy, BlockerPolicy, SuccessGate, ExecutionLog, ToolRegistry, ReferenceResolver, Planner, Executor

## Test Strategies

### Unit Tests
All packages have unit tests using `bun:test`.

### Integration Tests
The `@pascal/agent-testkit` package provides scenario harnesses that test end-to-end flows.

### Provider Tests
- Mock provider: Always available, deterministic
- Ollama provider: Tested with health check (skip if unavailable)
- OpenAI provider: Tested with health check (skip if unavailable)

### Scenario Tests
Scenarios test common workflows:

1. Inspect a wall → verify response structure
2. Resolve an English reference → verify correct wall ID
3. Dry-run a wall move → verify impact report
4. Add a window → verify wall bounds
5. Detect ambiguity → verify clarification needed
6. Validate impacted walls → verify multi-wall effects