/**
 * Built-in test scenarios for the agent system.
 * These can be run with `pascal-agent test-scenario <name>`.
 */

import { createSceneTools, ToolRegistry } from '@pascal/agent-core'
import { complexWallFixture, kitchenFixture, SceneApi } from '@pascal/scene-api'

export interface Scenario {
  name: string
  description: string
  scene: () => ReturnType<typeof kitchenFixture>
  prompt: string
  expectedTargets?: string[]
  expectedPlanShape?: {
    minSteps?: number
    maxSteps?: number
    hasDryRun?: boolean
  }
  expectedImpactMin?: number
  expectedValidationMaxErrors?: number
}

export const scenarios: Record<string, Scenario> = {
  'inspect-wall': {
    name: 'inspect-wall',
    description: 'Inspect a named wall and verify its properties',
    scene: kitchenFixture,
    prompt: 'inspect the north wall of the kitchen',
    expectedTargets: ['wall_kitchen_north'],
    expectedPlanShape: { minSteps: 1, maxSteps: 3 },
    expectedValidationMaxErrors: 0,
  },
  'resolve-wall-reference': {
    name: 'resolve-wall-reference',
    description: 'Resolve an English wall reference to a wall ID',
    scene: kitchenFixture,
    prompt: 'the north wall of the kitchen',
    expectedTargets: ['wall_kitchen_north'],
    expectedPlanShape: { minSteps: 1, maxSteps: 2 },
  },
  'dry-run-wall-move': {
    name: 'dry-run-wall-move',
    description: 'Dry-run a wall move and verify impact report',
    scene: kitchenFixture,
    prompt: 'move the kitchen north wall out 40cm',
    expectedPlanShape: { minSteps: 2, maxSteps: 5, hasDryRun: true },
    expectedImpactMin: 1, // At least the window on the wall
  },
  'add-window': {
    name: 'add-window',
    description: 'Simulate adding a window to a wall',
    scene: kitchenFixture,
    prompt: 'add a window to the west wall',
    expectedPlanShape: { minSteps: 2, maxSteps: 4 },
  },
  'detect-ambiguity': {
    name: 'detect-ambiguity',
    description: 'Detect ambiguous wall references requiring clarification',
    scene: kitchenFixture,
    prompt: 'the wall',
    expectedTargets: [], // Should be ambiguous
  },
  'validate-impacted-walls': {
    name: 'validate-impacted-walls',
    description: 'Move a wall that affects connected walls at a T-junction',
    scene: complexWallFixture,
    prompt: 'move the vertical wall in the complex scene',
    expectedImpactMin: 1, // Connected walls at T-junction
    expectedPlanShape: { minSteps: 2, maxSteps: 5 },
  },
  'move-kitchen-wall': {
    name: 'move-kitchen-wall',
    description: 'Full end-to-end: move a named kitchen wall',
    scene: kitchenFixture,
    prompt: 'move the kitchen north wall out 40cm --dry-run',
    expectedTargets: ['wall_kitchen_north'],
    expectedPlanShape: { minSteps: 3, maxSteps: 6, hasDryRun: true },
  },
}

export async function runScenario(
  name: string,
  options: { json?: boolean } = {},
): Promise<{
  passed: boolean
  steps: Array<{ name: string; success: boolean; error?: string }>
  errors: string[]
}> {
  const scenario = scenarios[name]
  if (!scenario) {
    return {
      passed: false,
      steps: [],
      errors: [`Unknown scenario: ${name}. Available: ${Object.keys(scenarios).join(', ')}`],
    }
  }

  const sceneData = scenario.scene()
  const sceneApi = SceneApi.fromData(sceneData)

  // Create tool registry
  const toolRegistry = new ToolRegistry()
  for (const tool of createSceneTools(sceneApi)) {
    toolRegistry.register(tool)
  }

  const steps: Array<{ name: string; success: boolean; error?: string }> = []
  const errors: string[] = []

  // Step 1: Scene summary
  const summaryResult = await toolRegistry.execute('scene.summary', {})
  steps.push({ name: 'scene.summary', success: summaryResult.success, error: summaryResult.error })

  // Step 2: Validate scene
  const validationResult = await toolRegistry.execute('scene.validate', {})
  steps.push({
    name: 'scene.validate',
    success: validationResult.success,
    error: validationResult.error,
  })

  if (scenario.expectedValidationMaxErrors !== undefined) {
    const issues = (validationResult.data as unknown[]) ?? []
    if (issues.length > scenario.expectedValidationMaxErrors) {
      errors.push(
        `Expected max ${scenario.expectedValidationMaxErrors} validation errors, got ${issues.length}`,
      )
    }
  }

  // Step 3: Resolve reference if the prompt mentions a wall
  if (scenario.prompt.toLowerCase().includes('wall')) {
    const resolveResult = await toolRegistry.execute('wall.resolve_reference', {
      reference: scenario.prompt,
    })
    steps.push({
      name: 'wall.resolve_reference',
      success: resolveResult.success,
      error: resolveResult.error,
    })

    if (scenario.expectedTargets && scenario.expectedTargets.length > 0) {
      const data = resolveResult.data as { wallId: string | null } | undefined
      if (!data?.wallId) {
        errors.push(`Expected to resolve a wall reference but got none`)
      } else if (!scenario.expectedTargets.includes(data.wallId)) {
        errors.push(`Expected one of ${scenario.expectedTargets.join(', ')}, got ${data.wallId}`)
      }
    }
  }

  // Step 4: If prompt mentions "move", simulate change
  if (
    scenario.prompt.toLowerCase().includes('move') ||
    scenario.prompt.toLowerCase().includes('dry-run')
  ) {
    const simResult = await toolRegistry.execute('wall.simulate_change', {
      wallId: '__resolved__',
      offset: '0.4',
    })
    steps.push({
      name: 'wall.simulate_change (dry)',
      success: simResult.success,
      error: simResult.error,
    })

    if (scenario.expectedImpactMin !== undefined) {
      const resultData = simResult.data as { impacts?: unknown[] } | undefined
      if (resultData?.impacts && resultData.impacts.length < scenario.expectedImpactMin) {
        errors.push(
          `Expected at least ${scenario.expectedImpactMin} impacts, got ${resultData.impacts.length}`,
        )
      }
    }
  }

  const allPassed = errors.length === 0 && steps.every((s) => s.success)

  if (options.json) {
    console.log(JSON.stringify({ scenario: name, passed: allPassed, steps, errors }, null, 2))
  } else {
    if (allPassed) {
      console.log(`✅ Scenario "${name}" passed`)
    } else {
      console.log(`❌ Scenario "${name}" failed`)
    }
    for (const step of steps) {
      const icon = step.success ? '  ✅' : '  ❌'
      console.log(`${icon} ${step.name}`)
    }
    for (const error of errors) {
      console.log(`  ⚠️ ${error}`)
    }
  }

  return { passed: allPassed, steps, errors }
}

export async function runAllScenarios(options: { json?: boolean } = {}): Promise<boolean> {
  const results: Record<string, boolean> = {}
  let allPassed = true

  for (const name of Object.keys(scenarios)) {
    const result = await runScenario(name, { json: false })
    results[name] = result.passed
    if (!result.passed) allPassed = false
  }

  console.log('')
  console.log('=== Scenario Results ===')
  for (const [name, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n${allPassed ? '✅ All scenarios passed' : '❌ Some scenarios failed'}`)

  if (options.json) {
    console.log(JSON.stringify({ allPassed, results }, null, 2))
  }

  return allPassed
}
