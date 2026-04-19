import { describe, expect, test } from 'bun:test'
import { MockProvider } from '@pascal/agent-models'
import { createMinimalScene, kitchenFixture, SceneApi } from '@pascal/scene-api'
import { LLMPlanner } from '../planner/llm-planner'
import { LLMReferenceResolver } from '../resolver/llm-reference-resolver'
import { ReferenceResolver } from '../resolver/reference-resolver'

describe('LLMReferenceResolver', () => {
  test('falls back to heuristic when no provider', async () => {
    const api = SceneApi.fromData(kitchenFixture())
    const resolver = new LLMReferenceResolver(api)
    const result = await resolver.resolve('wall_kitchen_north')

    expect(result.matched).toBe(true)
    expect(result.wallId).toBe('wall_kitchen_north')
  })

  test('uses heuristic for high-confidence direct ID match', async () => {
    const api = SceneApi.fromData(createMinimalScene())
    const mockProvider = new MockProvider('test')
    mockProvider.registerResponse(
      'wall',
      '{ "wallId": "wall_test1", "confidence": 1.0, "reasoning": "test", "ambiguous": false, "alternatives": [] }',
    )

    const resolver = new LLMReferenceResolver(api, mockProvider)
    const result = await resolver.resolve('wall_test1')

    // Should use heuristic (direct ID match) without calling LLM
    expect(result.matched).toBe(true)
    expect(result.wallId).toBe('wall_test1')
  })

  test('uses heuristic for name match', async () => {
    const api = SceneApi.fromData(kitchenFixture())
    const resolver = new LLMReferenceResolver(api)
    const result = await resolver.resolve('North Wall')

    expect(result.matched).toBe(true)
    expect(result.wallId).toBe('wall_kitchen_north')
  })

  test('consults LLM for ambiguous references', async () => {
    const api = SceneApi.fromData(kitchenFixture())
    const mockProvider = new MockProvider('test-llm')
    mockProvider.registerResponse(
      'the wall near the counter',
      JSON.stringify({
        wallId: 'wall_kitchen_north',
        confidence: 0.75,
        reasoning: 'The north wall of the kitchen is near the counter area',
        ambiguous: false,
        alternatives: [],
      }),
    )

    const resolver = new LLMReferenceResolver(api, mockProvider)
    const result = await resolver.resolve('the wall near the counter')

    // Should consult LLM for this ambiguous reference
    expect(result.matched).toBe(true)
  })

  test('inherits heuristic resolver functionality', () => {
    const api = SceneApi.fromData(createMinimalScene())
    const resolver = new LLMReferenceResolver(api)

    // Should be able to use all parent methods
    expect(resolver).toBeInstanceOf(ReferenceResolver)
  })
})

describe('LLMPlanner', () => {
  test('falls back to heuristic when no provider provided', async () => {
    const planner = new LLMPlanner()
    const plan = await planner.createPlan({ userRequest: 'inspect the north wall' })

    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.intent).toBeTruthy()
  })

  test('uses LLM when provider is available', async () => {
    const mockProvider = new MockProvider('test-planner')
    mockProvider.registerResponse(
      'move',
      JSON.stringify({
        intent: 'Move wall out 40cm',
        assumptions: ['User wants to move a wall'],
        targetIds: [],
        steps: [
          {
            name: 'resolve_reference',
            description: 'Resolve wall reference',
            tool: 'wall.resolve_reference',
            args: { reference: 'kitchen wall' },
          },
          {
            name: 'simulate_change',
            description: 'Simulate wall move',
            tool: 'wall.simulate_change',
            args: { wallId: '__resolved__', end: [4.4, 0] },
            dryRun: true,
          },
          { name: 'validate', description: 'Validate scene', tool: 'scene.validate', args: {} },
          {
            name: 'apply_change',
            description: 'Apply wall move',
            tool: 'wall.apply_change',
            args: { wallId: '__resolved__', end: [4.4, 0] },
          },
        ],
        risks: ['Wall movement may affect connected walls'],
        needsConfirmation: true,
      }),
    )

    const planner = new LLMPlanner(mockProvider)
    const plan = await planner.createPlan({
      userRequest: 'move the kitchen north wall out 40cm',
      sceneSummary: {
        rootNodeIds: ['site_1'],
        nodes: [],
        stats: {
          sites: 1,
          buildings: 1,
          levels: 1,
          walls: 2,
          windows: 0,
          doors: 0,
          zones: 1,
          items: 0,
          slabs: 0,
          ceilings: 0,
          roofs: 0,
          stairs: 0,
          fences: 0,
          total: 5,
        },
      },
    })

    expect(plan.steps.length).toBeGreaterThanOrEqual(1)
    expect(plan.intent).toBeTruthy()
  })

  test('falls back to heuristic on LLM error', async () => {
    // A provider that throws
    const brokenProvider = new MockProvider('broken')
    // Don't register anything — it will return default response which can't be parsed as JSON

    const planner = new LLMPlanner(brokenProvider)
    const plan = await planner.createPlan({ userRequest: 'inspect the wall' })

    // Should fall back to heuristic planner
    expect(plan.steps.length).toBeGreaterThan(0)
  })

  test('validates tool names in LLM response', async () => {
    const mockProvider = new MockProvider('test-validator')
    mockProvider.registerResponse(
      'delete',
      JSON.stringify({
        intent: 'Delete everything',
        assumptions: [],
        targetIds: [],
        steps: [
          { name: 'valid_step', description: 'Get summary', tool: 'scene.summary', args: {} },
          {
            name: 'invalid_step',
            description: 'Delete all',
            tool: 'scene.delete_everything',
            args: {},
          },
          { name: 'another_valid', description: 'Validate', tool: 'scene.validate', args: {} },
        ],
        risks: ['This is destructive'],
        needsConfirmation: true,
      }),
    )

    const planner = new LLMPlanner(mockProvider)
    const plan = await planner.createPlan({
      userRequest: 'delete everything',
      sceneSummary: {
        rootNodeIds: [],
        nodes: [],
        stats: {
          sites: 0,
          buildings: 0,
          levels: 0,
          walls: 0,
          windows: 0,
          doors: 0,
          zones: 0,
          items: 0,
          slabs: 0,
          ceilings: 0,
          roofs: 0,
          stairs: 0,
          fences: 0,
          total: 0,
        },
      },
    })

    // Should only include valid tools
    const validTools = [
      'scene.summary',
      'scene.find_nodes',
      'wall.inspect',
      'wall.resolve_reference',
      'wall.simulate_change',
      'wall.apply_change',
      'scene.validate',
      'scene.diff',
      'task.report_progress',
    ]
    for (const step of plan.steps) {
      expect(validTools).toContain(step.tool)
    }
  })
})
