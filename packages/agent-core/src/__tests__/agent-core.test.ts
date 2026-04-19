import { describe, expect, test } from 'bun:test'
import { createMinimalScene, kitchenFixture, SceneApi } from '@pascal/scene-api'
import { z } from 'zod'
import { Executor } from '../executor/executor'
import { Planner } from '../planner/planner'
import { ReferenceResolver } from '../resolver/reference-resolver'
import { BlockerPolicy } from '../runtime/blocker-policy'
import { ExecutionLog } from '../runtime/execution-log'
import { RetryPolicy } from '../runtime/retry-policy'
import { SuccessGate } from '../runtime/success-gate'
import { TaskRunner } from '../runtime/task-runner'
import { ToolRegistry } from '../tools/registry'

describe('agent-core', () => {
  describe('TaskRunner', () => {
    test('executes a simple plan', async () => {
      const runner = new TaskRunner()
      const plan = {
        intent: 'test',
        assumptions: [],
        targetIds: [],
        steps: [{ name: 'step1', description: 'Step 1', tool: 'test', args: {} }],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }

      const result = await runner.run(plan, async () => 'ok')
      expect(result.success).toBe(true)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].success).toBe(true)
    })

    test('retries on transient failure', async () => {
      const runner = new TaskRunner({ retry: { maxRetries: 3, baseDelayMs: 10 } })
      const plan = {
        intent: 'test',
        assumptions: [],
        targetIds: [],
        steps: [{ name: 'step1', description: 'Step 1', tool: 'test', args: {} }],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }

      let attempts = 0
      const result = await runner.run(plan, async () => {
        attempts++
        if (attempts < 3) throw new Error('Temporary network issue')
        return 'ok'
      })

      expect(result.success).toBe(true)
      expect(attempts).toBe(3)
    })

    test('stops on blocker', async () => {
      const runner = new TaskRunner({ retry: { maxRetries: 5, baseDelayMs: 10 } })
      const plan = {
        intent: 'test',
        assumptions: [],
        targetIds: [],
        steps: [{ name: 'step1', description: 'Step 1', tool: 'test', args: {} }],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }

      const result = await runner.run(plan, async () => {
        throw new Error('Missing API key: unauthorized')
      })

      expect(result.success).toBe(false)
      expect(result.steps[0].classification).toBe('blocker')
    })
  })

  describe('RetryPolicy', () => {
    test('should retry with exponential backoff', () => {
      const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 100 })
      expect(policy.shouldRetry(0, 'error')).toBe(true)
      expect(policy.shouldRetry(1, 'error')).toBe(true)
      expect(policy.shouldRetry(2, 'error')).toBe(true)
      expect(policy.shouldRetry(3, 'error')).toBe(false)
    })

    test('delays increase exponentially', () => {
      const policy = new RetryPolicy({ baseDelayMs: 100, maxDelayMs: 10000 })
      expect(policy.getDelay(0)).toBe(100)
      expect(policy.getDelay(1)).toBe(200)
      expect(policy.getDelay(2)).toBe(400)
    })
  })

  describe('BlockerPolicy', () => {
    test('classifies missing credentials as blocker', () => {
      const policy = new BlockerPolicy()
      expect(policy.classify('Missing API key')).toBe('blocker')
      expect(policy.classify('Unauthorized access')).toBe('blocker')
    })

    test('classifies network errors as fixable', () => {
      const policy = new BlockerPolicy()
      expect(policy.classify('Network timeout')).toBe('fixable')
      expect(policy.classify('Rate limit exceeded')).toBe('fixable')
    })

    test('classifies unknown errors as unknown', () => {
      const policy = new BlockerPolicy()
      expect(policy.classify('Something went wrong')).toBe('unknown')
    })
  })

  describe('SuccessGate', () => {
    test('passes when all criteria pass', async () => {
      const gate = new SuccessGate()
      gate.add({ name: 'test1', check: () => true })
      gate.add({ name: 'test2', check: () => true })

      const result = await gate.evaluate()
      expect(result.passed).toBe(true)
      expect(result.results).toHaveLength(2)
    })

    test('fails when any criterion fails', async () => {
      const gate = new SuccessGate()
      gate.add({ name: 'test1', check: () => true })
      gate.add({ name: 'test2', check: () => false })

      const result = await gate.evaluate()
      expect(result.passed).toBe(false)
    })

    test('supports async criteria', async () => {
      const gate = new SuccessGate()
      gate.add({ name: 'async', check: async () => true })

      const result = await gate.evaluate()
      expect(result.passed).toBe(true)
    })
  })

  describe('ExecutionLog', () => {
    test('captures log entries', () => {
      const log = new ExecutionLog()
      log.info('step1', 'Starting')
      log.warn('step2', 'Warning')
      log.error('step3', 'Error')

      const entries = log.getEntries()
      expect(entries).toHaveLength(3)
      expect(entries[0].level).toBe('info')
      expect(entries[1].level).toBe('warn')
      expect(entries[2].level).toBe('error')
    })

    test('clears entries', () => {
      const log = new ExecutionLog()
      log.info('step1', 'Test')
      log.clear()
      expect(log.getEntries()).toHaveLength(0)
    })
  })

  describe('ToolRegistry', () => {
    test('registers and executes a tool', async () => {
      const registry = new ToolRegistry()
      registry.register({
        name: 'add',
        description: 'Add two numbers',
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: async (args) => {
          const { a, b } = args as { a: number; b: number }
          return { success: true, data: a + b }
        },
      })

      const result = await registry.execute('add', { a: 2, b: 3 })
      expect(result.success).toBe(true)
      expect(result.data).toBe(5)
    })

    test('rejects invalid arguments', async () => {
      const registry = new ToolRegistry()
      registry.register({
        name: 'add',
        description: 'Add two numbers',
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: async (args) => ({ success: true, data: 0 }),
      })

      const result = await registry.execute('add', { a: 'not a number', b: 3 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid arguments')
    })

    test('rejects unknown tool', async () => {
      const registry = new ToolRegistry()
      const result = await registry.execute('nonexistent', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    test('supports dry run', async () => {
      const registry = new ToolRegistry()
      registry.register({
        name: 'mutate',
        description: 'A mutating tool',
        parameters: z.object({ value: z.number() }),
        execute: async (args) => ({ success: true, data: 'applied' }),
        supportsDryRun: true,
        dryRun: async (args) => ({ success: true, data: 'simulated' }),
      })

      const dryResult = await registry.execute('mutate', { value: 42 }, true)
      expect(dryResult.data).toBe('simulated')
    })
  })

  describe('ReferenceResolver', () => {
    test('resolves a wall by ID', async () => {
      const api = SceneApi.fromData(createMinimalScene())
      const resolver = new ReferenceResolver(api)

      const result = await resolver.resolve('wall_test1')
      expect(result.matched).toBe(true)
      expect(result.wallId).toBe('wall_test1')
      expect(result.confidence).toBe(1.0)
    })

    test('resolves a wall by name', async () => {
      const api = SceneApi.fromData(kitchenFixture())
      const resolver = new ReferenceResolver(api)

      const result = await resolver.resolve('North Wall')
      expect(result.matched).toBe(true)
      expect(result.wallId).toBe('wall_kitchen_north')
    })

    test('handles ambiguous references', async () => {
      const api = SceneApi.fromData(createMinimalScene())
      const resolver = new ReferenceResolver(api)

      const result = await resolver.resolve('nonexistent wall xyz')
      expect(result.matched).toBe(false)
    })
  })

  describe('Planner', () => {
    test('creates a plan for a wall move request', () => {
      const planner = new Planner()
      const plan = planner.createPlan({ userRequest: 'move the kitchen north wall out 40cm' })

      expect(plan.intent).toContain('Move wall')
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.needsConfirmation).toBe(true)
    })

    test('creates a plan for a wall inspect request', () => {
      const planner = new Planner()
      const plan = planner.createPlan({ userRequest: 'inspect the north wall' })

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.needsConfirmation).toBe(false)
    })

    test('creates a default plan for unknown requests', () => {
      const planner = new Planner()
      const plan = planner.createPlan({ userRequest: 'what is this scene?' })

      expect(plan.steps.length).toBeGreaterThan(0)
    })
  })

  describe('Executor', () => {
    test('executes a simple plan', async () => {
      const api = SceneApi.fromData(createMinimalScene())
      const registry = new ToolRegistry()
      registry.register({
        name: 'test_tool',
        description: 'Test tool',
        parameters: z.object({}),
        execute: async () => ({ success: true, data: 'test' }),
      })

      const executor = new Executor(registry)
      const plan = {
        intent: 'test',
        assumptions: [],
        targetIds: [],
        steps: [{ name: 'step1', description: 'Test', tool: 'test_tool', args: {} }],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }

      const result = await executor.execute(plan)
      expect(result.success).toBe(true)
    })

    test('stops on tool execution failure', async () => {
      const registry = new ToolRegistry()
      registry.register({
        name: 'failing_tool',
        description: 'Failing tool',
        parameters: z.object({}),
        execute: async () => ({ success: false, error: 'Tool failed' }),
      })

      const executor = new Executor(registry)
      const plan = {
        intent: 'test',
        assumptions: [],
        targetIds: [],
        steps: [{ name: 'step1', description: 'Test', tool: 'failing_tool', args: {} }],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }

      const result = await executor.execute(plan)
      expect(result.success).toBe(false)
    })
  })
})
