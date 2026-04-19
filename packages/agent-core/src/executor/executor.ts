/**
 * Executor — runs a plan step by step using the tool registry.
 */

import type { Plan, PlanStep } from '../planner/planner'
import type { ToolRegistry, ToolResult } from '../tools/registry'

export interface ExecutionResult {
  success: boolean
  steps: Array<{
    step: PlanStep
    result: ToolResult
  }>
  error?: string
}

export class Executor {
  private toolRegistry: ToolRegistry

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry
  }

  /**
   * Execute a plan step by step.
   * If a step uses __resolved__ as a value, it will be replaced
   * by the resolved wallId from the first step's result.
   */
  async execute(plan: Plan): Promise<ExecutionResult> {
    const results: ExecutionResult['steps'] = []
    let resolvedId: string | null = null

    for (const step of plan.steps) {
      const args = { ...step.args }

      // Replace __resolved__ with the resolved ID from earlier steps
      if (resolvedId) {
        for (const [key, value] of Object.entries(args)) {
          if (value === '__resolved__') {
            args[key] = resolvedId
          }
        }
      }

      const result = await this.toolRegistry.execute(step.tool, args, step.dryRun)

      // Capture resolved reference
      if (step.tool === 'wall.resolve_reference' && result.success && result.data) {
        const data = result.data as { wallId: string | null }
        resolvedId = data.wallId
      }

      results.push({ step, result })

      // Stop on error (unless it's a non-critical step)
      if (!result.success && step.tool !== 'scene.validate') {
        return {
          success: false,
          steps: results,
          error: result.error ?? `Step "${step.name}" failed`,
        }
      }
    }

    return {
      success: results.every((r) => r.result.success),
      steps: results,
    }
  }
}
