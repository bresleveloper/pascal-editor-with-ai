/**
 * Enhanced English reference resolver.
 *
 * Uses the LLM to interpret natural language wall references when
 * the heuristic resolver is ambiguous or fails. Falls back to
 * the heuristic resolver for deterministic patterns (IDs, exact names).
 */

import type { ModelProvider } from '@pascal/agent-models'
import type { SceneApi } from '@pascal/scene-api'
import { ReferenceResolver, type ResolvedReference } from './reference-resolver'

export interface LLMResolvedReference extends ResolvedReference {
  /** The original user prompt */
  originalPrompt: string
  /** The LLM's reasoning for the resolution */
  reasoning: string
  /** Whether the LLM was consulted */
  usedLLM: boolean
}

const SYSTEM_PROMPT = `You are a wall reference resolver for a 3D building editor.
Given a natural language wall reference and a scene description, identify the most likely wall ID.
Respond ONLY with JSON in this format:
{
  "wallId": "the_wall_id_or_null",
  "confidence": 0.0_to_1.0,
  "reasoning": "explanation of why this wall matches",
  "ambiguous": true_or_false,
  "alternatives": [
    { "wallId": "other_wall_id", "confidence": 0.0_to_1.0, "reasoning": "why" }
  ]
}`

export class LLMReferenceResolver extends ReferenceResolver {
  private provider: ModelProvider | null

  constructor(sceneApi: SceneApi, provider?: ModelProvider) {
    super(sceneApi)
    this.provider = provider ?? null
  }

  /**
   * Resolve a wall reference, using LLM if the heuristic resolver
   * is ambiguous or low-confidence.
   */
  async resolve(reference: string): Promise<ResolvedReference> {
    // First try heuristic resolution
    const heuristicResult = await super.resolve(reference)

    // If confidence is high and not ambiguous, use the heuristic result
    if (
      heuristicResult.matched &&
      heuristicResult.confidence >= 0.7 &&
      !heuristicResult.ambiguity
    ) {
      return heuristicResult
    }

    // If no provider available, return heuristic result as-is
    if (!this.provider) {
      return heuristicResult
    }

    // Try LLM resolution
    try {
      return await this.resolveWithLLM(reference)
    } catch (error) {
      // LLM failed, return heuristic result
      return heuristicResult
    }
  }

  /**
   * Resolve using the LLM for better natural language understanding.
   */
  private async resolveWithLLM(reference: string): Promise<LLMResolvedReference> {
    if (!this.provider) {
      throw new Error('No provider available')
    }

    // Build scene context
    const summary = this.sceneApi.getSceneSummary()
    const walls = this.sceneApi.findNodes({ type: 'wall' })
    const wallDescriptions = walls
      .map((w) => {
        const info = this.sceneApi.inspectWall(w.id)
        return info
          ? `  - ${w.id}${w.name ? ` "${w.name}"` : ''}: start(${info.start[0].toFixed(1)},${info.start[1].toFixed(1)}) end(${info.end[0].toFixed(1)},${info.end[1].toFixed(1)}) length=${info.length.toFixed(2)}m angle=${((info.angle * 180) / Math.PI).toFixed(0)}°`
          : `  - ${w.id}${w.name ? ` "${w.name}"` : ''}`
      })
      .join('\n')

    const zones = this.sceneApi.findNodes({ type: 'zone' })
    const zoneDescriptions = zones
      .map((z) => `  - ${z.id}${z.name ? ` "${z.name}"` : ''}`)
      .join('\n')

    const sceneContext = `Scene summary: ${summary.stats.walls} walls, ${summary.stats.windows} windows, ${summary.stats.doors} doors, ${summary.stats.zones} zones

Walls:
${wallDescriptions}

Zones:
${zoneDescriptions}

User reference: "${reference}"`

    const response = await this.provider.complete({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: sceneContext },
      ],
      responseFormat: { type: 'json' },
    })

    // Parse the LLM response
    let parsed: {
      wallId: string | null
      confidence: number
      reasoning: string
      ambiguous: boolean
      alternatives: Array<{ wallId: string; confidence: number; reasoning: string }>
    }

    try {
      parsed = JSON.parse(response.content)
    } catch {
      // LLM didn't return valid JSON, try to extract from text
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('LLM did not return valid JSON')
      }
    }

    // Validate the wall ID exists in the scene
    if (parsed.wallId) {
      const node = this.sceneApi.getNode(parsed.wallId)
      if (!node || node.type !== 'wall') {
        parsed.wallId = null
        parsed.confidence = 0
      }
    }

    // Build candidates from alternatives
    const candidates: ResolvedReference['candidates'] = (parsed.alternatives ?? [])
      .filter((alt) => {
        const node = this.sceneApi.getNode(alt.wallId)
        return node && node.type === 'wall'
      })
      .map((alt) => ({
        wallId: alt.wallId,
        reason: alt.reasoning,
        confidence: alt.confidence,
      }))

    // Add the main match as the first candidate if it exists
    if (parsed.wallId) {
      candidates.unshift({
        wallId: parsed.wallId,
        reason: parsed.reasoning,
        confidence: parsed.confidence,
      })
    }

    return {
      matched: parsed.wallId !== null && parsed.confidence >= 0.5,
      wallId: parsed.wallId,
      confidence: parsed.confidence,
      candidates,
      ambiguity: parsed.ambiguous,
      reason: parsed.reasoning,
      originalPrompt: reference,
      reasoning: parsed.reasoning,
      usedLLM: true,
    }
  }
}
