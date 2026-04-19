/**
 * English reference resolver — turns natural language wall references
 * into specific wall IDs with confidence scoring.
 */

import type { SceneApi } from '@pascal/scene-api'

export interface ResolvedReference {
  matched: boolean
  wallId: string | null
  confidence: number
  candidates: Array<{
    wallId: string
    name?: string
    reason: string
    confidence: number
  }>
  ambiguity: boolean
  reason: string
}

/**
 * Simple keyword-based reference resolver.
 * A more sophisticated version would use the LLM, but this covers
 * common patterns for deterministic testing.
 */
export class ReferenceResolver {
  private sceneApi: SceneApi

  constructor(sceneApi: SceneApi) {
    this.sceneApi = sceneApi
  }

  /**
   * Resolve a natural language reference to a wall ID.
   *
   * Supported patterns:
   * - "the north wall of the kitchen"
   * - "the left wall in this room"
   * - "the wall with the big window"
   * - Named walls
   * - Wall IDs directly
   */
  async resolve(reference: string): Promise<ResolvedReference> {
    const normalized = reference.toLowerCase().trim()

    // Direct ID reference
    if (normalized.startsWith('wall_')) {
      const node = this.sceneApi.getNode(normalized)
      if (node && node.type === 'wall') {
        return {
          matched: true,
          wallId: normalized,
          confidence: 1.0,
          candidates: [{ wallId: normalized, reason: 'Direct ID reference', confidence: 1.0 }],
          ambiguity: false,
          reason: `Direct ID match: ${normalized}`,
        }
      }
    }

    // Named wall reference
    const summary = this.sceneApi.getSceneSummary()
    const wallNodes = this.sceneApi.findNodes({ type: 'wall' })
    const candidates: ResolvedReference['candidates'] = []

    for (const wallNode of wallNodes) {
      const wallInfo = this.sceneApi.inspectWall(wallNode.id)
      if (!wallInfo) continue

      // Check name match
      if (wallNode.name && normalized.includes(wallNode.name.toLowerCase())) {
        candidates.push({
          wallId: wallNode.id,
          name: wallNode.name,
          reason: `Name match: "${wallNode.name}"`,
          confidence: 0.9,
        })
        continue
      }

      // Check directional reference
      const direction = this.extractDirection(normalized)
      if (direction) {
        const wallAngleDeg = (wallInfo.angle * 180) / Math.PI
        if (this.directionMatches(direction, wallAngleDeg)) {
          candidates.push({
            wallId: wallNode.id,
            name: wallNode.name,
            reason: `Direction match: ${direction} wall (angle: ${wallAngleDeg.toFixed(0)}°)`,
            confidence: 0.7,
          })
        }
      }

      // Check zone/room reference
      const roomName = this.extractRoomName(normalized)
      if (roomName) {
        const zones = this.sceneApi.findNodes({ type: 'zone' })
        for (const zone of zones) {
          if (zone.name?.toLowerCase().includes(roomName)) {
            // Check if this wall is in the same level as this zone
            if (wallNode.parentId === zone.parentId) {
              candidates.push({
                wallId: wallNode.id,
                name: wallNode.name,
                reason: `In zone "${zone.name}"`,
                confidence: 0.6,
              })
            }
          }
        }
      }

      // Check if wall has openings (window/door)
      if (normalized.includes('window') || normalized.includes('door')) {
        if (wallInfo.children.length > 0) {
          candidates.push({
            wallId: wallNode.id,
            name: wallNode.name,
            reason: 'Wall has openings',
            confidence: 0.4,
          })
        }
      }
    }

    // Remove duplicate candidates (prefer higher confidence)
    const uniqueCandidates = new Map<string, ResolvedReference['candidates'][0]>()
    for (const c of candidates) {
      const existing = uniqueCandidates.get(c.wallId)
      if (!existing || c.confidence > existing.confidence) {
        uniqueCandidates.set(c.wallId, c)
      }
    }

    const sortedCandidates = [...uniqueCandidates.values()].sort(
      (a, b) => b.confidence - a.confidence,
    )

    if (sortedCandidates.length === 0) {
      return {
        matched: false,
        wallId: null,
        confidence: 0,
        candidates: [],
        ambiguity: false,
        reason: `No walls matched reference: "${reference}"`,
      }
    }

    const topCandidate = sortedCandidates[0]
    const isAmbiguous =
      sortedCandidates.length > 1 &&
      sortedCandidates[0].confidence - sortedCandidates[1].confidence < 0.2

    return {
      matched: topCandidate.confidence >= 0.5,
      wallId: topCandidate.wallId,
      confidence: topCandidate.confidence,
      candidates: sortedCandidates,
      ambiguity: isAmbiguous,
      reason: topCandidate.reason,
    }
  }

  private extractDirection(ref: string): string | null {
    if (ref.includes('north') || ref.includes('top')) return 'north'
    if (ref.includes('south') || ref.includes('bottom')) return 'south'
    if (ref.includes('east') || ref.includes('right')) return 'east'
    if (ref.includes('west') || ref.includes('left')) return 'west'
    return null
  }

  private extractRoomName(ref: string): string | null {
    // Patterns like "wall of the kitchen", "kitchen wall", "in this room"
    const patterns = [/wall\s+(?:of|in)\s+the\s+(\w+)/, /(\w+)\s+wall/, /in\s+(?:the\s+)?(\w+)/]
    for (const pattern of patterns) {
      const match = ref.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  private directionMatches(direction: string, angleDeg: number): boolean {
    // Normalize angle to [0, 360)
    const normalized = ((angleDeg % 360) + 360) % 360

    switch (direction) {
      case 'east':
        return normalized >= 315 || normalized < 45 || (normalized >= 0 && normalized < 45)
      case 'north':
        return normalized >= 45 && normalized < 135
      case 'west':
        return normalized >= 135 && normalized < 225
      case 'south':
        return normalized >= 225 && normalized < 315
      default:
        return false
    }
  }
}
