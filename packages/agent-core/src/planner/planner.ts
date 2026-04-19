/**
 * Planner — creates structured plans from user requests.
 */

export interface PlanStep {
  name: string
  description: string
  tool: string
  args: Record<string, unknown>
  dryRun?: boolean
}

export interface Plan {
  intent: string
  assumptions: string[]
  targetIds: string[]
  steps: PlanStep[]
  scope: {
    levelId?: string
    buildingId?: string
    siteId?: string
  }
  risks: string[]
  needsConfirmation: boolean
}

export interface PlanInput {
  userRequest: string
  sceneSummary?: unknown
  referenceResolution?: unknown
  impactContext?: unknown
}

export class Planner {
  /**
   * Create a structured plan from a user request.
   * In a full implementation, this calls the LLM.
   * For now, it provides a simple heuristic planner.
   */
  createPlan(input: PlanInput): Plan {
    const { userRequest } = input
    const normalized = userRequest.toLowerCase()

    // Pattern: move a wall
    const wallMoveMatch = normalized.match(
      /move\s+(?:the\s+)?(.+?)\s+wall\s+(?:out|in)?\s*(\d+)\s*(?:cm|m)/,
    )
    if (wallMoveMatch) {
      return {
        intent: `Move wall: ${wallMoveMatch[1]}`,
        assumptions: [`User wants to move the ${wallMoveMatch[1]} wall`],
        targetIds: [],
        steps: [
          {
            name: 'resolve_reference',
            description: `Resolve reference: "${wallMoveMatch[1]} wall"`,
            tool: 'wall.resolve_reference',
            args: { reference: wallMoveMatch[1] },
          },
          {
            name: 'simulate_change',
            description: 'Simulate the wall move',
            tool: 'wall.simulate_change',
            args: { wallId: '__resolved__', offset: wallMoveMatch[2] },
            dryRun: true,
          },
          {
            name: 'validate_scene',
            description: 'Validate after simulated change',
            tool: 'scene.validate',
            args: {},
          },
          {
            name: 'apply_change',
            description: 'Apply the wall move',
            tool: 'wall.apply_change',
            args: { wallId: '__resolved__', offset: wallMoveMatch[2] },
          },
        ],
        scope: {},
        risks: ['Wall movement may affect connected walls and openings'],
        needsConfirmation: true,
      }
    }

    // Pattern: inspect a wall
    const inspectMatch = normalized.match(/inspect\s+(?:the\s+)?(.+?)\s+wall/)
    if (inspectMatch) {
      return {
        intent: `Inspect wall: ${inspectMatch[1]}`,
        assumptions: [],
        targetIds: [],
        steps: [
          {
            name: 'resolve_reference',
            description: `Resolve reference: "${inspectMatch[1]} wall"`,
            tool: 'wall.resolve_reference',
            args: { reference: inspectMatch[1] },
          },
          {
            name: 'inspect_wall',
            description: 'Get wall details',
            tool: 'wall.inspect',
            args: { wallId: '__resolved__' },
          },
        ],
        scope: {},
        risks: [],
        needsConfirmation: false,
      }
    }

    // Default: scene summary
    return {
      intent: `Understand scene context`,
      assumptions: ['No specific action identified, providing scene summary'],
      targetIds: [],
      steps: [
        {
          name: 'scene_summary',
          description: 'Get scene summary',
          tool: 'scene.summary',
          args: {},
        },
      ],
      scope: {},
      risks: [],
      needsConfirmation: false,
    }
  }
}
