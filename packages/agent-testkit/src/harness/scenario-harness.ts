/**
 * Scenario harness — runs task scenarios end-to-end for acceptance testing.
 */

import { createSceneTools, ToolRegistry } from '@pascal/agent-core'
import type { SceneData } from '@pascal/scene-api'
import { complexWallFixture, kitchenFixture, multiLevelFixture, SceneApi } from '@pascal/scene-api'

export interface ScenarioInput {
  prompt: string
  scene?: SceneData
}

export interface ScenarioExpected {
  targetIds?: string[]
  planShape?: {
    minSteps?: number
    maxSteps?: number
    hasDryRun?: boolean
  }
  impactSummary?: {
    minImpacts?: number
  }
  validationResult?: {
    maxErrors?: number
  }
  finalDiff?: {
    minModified?: number
  }
}

export interface ScenarioResult {
  passed: boolean
  steps: Array<{
    name: string
    success: boolean
    error?: string
  }>
  errors: string[]
}

export interface ScenarioHarness {
  runScenario(
    name: string,
    input: ScenarioInput,
    expected: ScenarioExpected,
  ): Promise<ScenarioResult>
}

const FIXTURES: Record<string, SceneData> = {
  kitchen: kitchenFixture(),
  multiLevel: multiLevelFixture(),
  complex: complexWallFixture(),
}

export function createScenarioHarness(): ScenarioHarness {
  return {
    async runScenario(
      name: string,
      input: ScenarioInput,
      expected: ScenarioExpected,
    ): Promise<ScenarioResult> {
      const steps: ScenarioResult['steps'] = []
      const errors: string[] = []

      // Load scene
      const sceneData = input.scene ?? FIXTURES[name] ?? kitchenFixture()
      const sceneApi = SceneApi.fromData(sceneData)

      // Create tool registry
      const toolRegistry = new ToolRegistry()
      for (const tool of createSceneTools(sceneApi)) {
        toolRegistry.register(tool)
      }

      // Step 1: Scene summary
      const summaryResult = await toolRegistry.execute('scene.summary', {})
      steps.push({
        name: 'scene.summary',
        success: summaryResult.success,
        error: summaryResult.error,
      })

      // Step 2: Validate scene
      const validationResult = await toolRegistry.execute('scene.validate', {})
      steps.push({
        name: 'scene.validate',
        success: validationResult.success,
        error: validationResult.error,
      })

      if (expected.validationResult?.maxErrors !== undefined) {
        const issues = (validationResult.data as unknown[]) ?? []
        if (issues.length > expected.validationResult.maxErrors) {
          errors.push(
            `Expected max ${expected.validationResult.maxErrors} validation errors, got ${issues.length}`,
          )
        }
      }

      // Step 3: If prompt mentions a wall reference, resolve it
      if (input.prompt.toLowerCase().includes('wall')) {
        const resolveResult = await toolRegistry.execute('wall.resolve_reference', {
          reference: input.prompt,
        })
        steps.push({
          name: 'wall.resolve_reference',
          success: resolveResult.success,
          error: resolveResult.error,
        })

        if (expected.targetIds && expected.targetIds.length > 0) {
          const data = resolveResult.data as { wallId: string | null } | undefined
          if (!data?.wallId) {
            errors.push(`Expected to resolve a wall reference but got none`)
          }
        }
      }

      // Step 4: If prompt mentions "move", simulate change
      if (input.prompt.toLowerCase().includes('move')) {
        const simResult = await toolRegistry.execute('wall.simulate_change', {
          wallId: '__resolved__',
          offset: '0.4',
        })
        steps.push({
          name: 'wall.simulate_change (dry)',
          success: simResult.success,
          error: simResult.error,
        })
      }

      // Evaluate plan shape expectations
      if (expected.planShape) {
        if (
          expected.planShape.minSteps !== undefined &&
          steps.length < expected.planShape.minSteps
        ) {
          errors.push(`Expected at least ${expected.planShape.minSteps} steps, got ${steps.length}`)
        }
        if (
          expected.planShape.maxSteps !== undefined &&
          steps.length > expected.planShape.maxSteps
        ) {
          errors.push(`Expected at most ${expected.planShape.maxSteps} steps, got ${steps.length}`)
        }
      }

      return {
        passed: errors.length === 0 && steps.every((s) => s.success || s.name === 'scene.validate'),
        steps,
        errors,
      }
    },
  }
}
