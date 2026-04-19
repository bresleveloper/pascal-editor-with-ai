/**
 * LLM-powered planner.
 *
 * Uses the model provider to generate structured plans from natural language
 * requests. Falls back to the heuristic planner when no provider is available
 * or the LLM fails.
 */

import type { ModelProvider } from '@pascal/agent-models'
import type { SceneSummary } from '@pascal/scene-api'
import { type Plan, type PlanInput, Planner, type PlanStep } from './planner'

const PLANNER_SYSTEM_PROMPT = `You are a building scene editor assistant.
Given a user request and scene context, create a plan to accomplish the task.

Respond ONLY with JSON in this format:
{
  "intent": "brief description of what the user wants",
  "assumptions": ["list of assumptions made"],
  "targetIds": ["wall_ids_or_node_ids targeted"],
  "steps": [
    {
      "name": "step_name",
      "description": "what this step does",
      "tool": "tool_name",
      "args": { "arg1": "value1" },
      "dryRun": false
    }
  ],
  "risks": ["list of risks"],
  "needsConfirmation": true_or_false
}

Available tools:
- scene.summary: Get scene overview. Args: { scope?: { levelId?, buildingId?, siteId? } }
- scene.find_nodes: Find nodes by type or name. Args: { type?, name?, parentId? }
- wall.inspect: Inspect a wall by ID. Args: { wallId }
- wall.resolve_reference: Resolve English reference to wall ID. Args: { reference }
- wall.simulate_change: Simulate a wall change (dry-run). Args: { wallId, start?, end?, thickness?, height? }
- wall.apply_change: Apply a wall change. Args: { wallId, start?, end?, thickness?, height? }
- scene.validate: Validate the scene. Args: { scope? }

IMPORTANT: Always include a wall.resolve_reference step first if the user mentions a wall by name.
Always include a wall.simulate_change (dry-run) step before wall.apply_change.
Always include a scene.validate step after simulated changes.`

export class LLMPlanner {
  private provider: ModelProvider | null
  private fallbackPlanner: Planner

  constructor(provider?: ModelProvider) {
    this.provider = provider ?? null
    this.fallbackPlanner = new Planner()
  }

  /**
   * Create a plan from a user request, using LLM when available.
   */
  async createPlan(input: PlanInput & { sceneSummary?: SceneSummary }): Promise<Plan> {
    // If no provider, fall back to heuristic
    if (!this.provider) {
      return this.fallbackPlanner.createPlan(input)
    }

    try {
      return await this.createPlanWithLLM(input)
    } catch (error) {
      // LLM failed, fall back to heuristic
      console.warn('[LLMPlanner] LLM plan generation failed, falling back to heuristic:', error)
      return this.fallbackPlanner.createPlan(input)
    }
  }

  private async createPlanWithLLM(
    input: PlanInput & { sceneSummary?: SceneSummary },
  ): Promise<Plan> {
    if (!this.provider) throw new Error('No provider available')

    const sceneContext = input.sceneSummary
      ? `Scene: ${input.sceneSummary.stats.walls} walls, ${input.sceneSummary.stats.zones} zones, ${input.sceneSummary.stats.windows} windows, ${input.sceneSummary.stats.doors} doors`
      : 'No scene context available'

    const userMessage = `User request: "${input.userRequest}"

${sceneContext}`

    const response = await this.provider.complete({
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      responseFormat: { type: 'json' },
    })

    // Parse the LLM response
    let parsed: {
      intent: string
      assumptions: string[]
      targetIds: string[]
      steps: Array<{
        name: string
        description: string
        tool: string
        args: Record<string, unknown>
        dryRun?: boolean
      }>
      risks: string[]
      needsConfirmation: boolean
    }

    try {
      parsed = JSON.parse(response.content)
    } catch {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('LLM did not return valid JSON')
      }
    }

    // Validate and normalize steps
    const validTools = new Set([
      'scene.summary',
      'scene.find_nodes',
      'wall.inspect',
      'wall.resolve_reference',
      'wall.simulate_change',
      'wall.apply_change',
      'scene.validate',
      'scene.diff',
      'task.report_progress',
    ])

    const steps: PlanStep[] = (parsed.steps ?? [])
      .filter((step) => validTools.has(step.tool))
      .map((step) => ({
        name: step.name,
        description: step.description,
        tool: step.tool,
        args: step.args ?? {},
        dryRun: step.dryRun ?? false,
      }))

    return {
      intent: parsed.intent ?? input.userRequest,
      assumptions: parsed.assumptions ?? [],
      targetIds: parsed.targetIds ?? [],
      steps,
      scope: {},
      risks: parsed.risks ?? [],
      needsConfirmation: parsed.needsConfirmation ?? true,
    }
  }
}
