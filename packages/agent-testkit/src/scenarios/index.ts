/**
 * Built-in test scenarios for the agent system.
 */

import { complexWallFixture, kitchenFixture } from '@pascal/scene-api'

export interface Scenario {
  name: string
  description: string
  scene: () => SceneData
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
    expectedImpactMin: 1,
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
    expectedTargets: [],
  },
  'validate-impacted-walls': {
    name: 'validate-impacted-walls',
    description: 'Move a wall that affects connected walls at a T-junction',
    scene: complexWallFixture,
    prompt: 'move the vertical wall in the complex scene',
    expectedImpactMin: 1,
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
