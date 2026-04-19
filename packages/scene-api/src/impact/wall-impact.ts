/**
 * Wall impact analysis engine.
 * Determines how a change to one wall affects other walls, openings, and spaces.
 */

import type {
  ImpactEntry,
  SceneData,
  ScopeOptions,
  WallChangeResult,
  WallImpactContext,
  WallPatch,
} from '../types'

/**
 * Build impact context for a given wall — what's connected, what's inside it, etc.
 */
export function getWallImpactContext(
  data: SceneData,
  wallId: string,
): WallImpactContext | undefined {
  const wall = data.nodes[wallId]
  if (!wall || wall.type !== 'wall') return undefined

  const connectedWalls = findConnectedWalls(data, wallId)
  const openings = findOpenings(data, wallId)
  const containingLevel = findAncestorOfType(data, wallId, 'level')
  const containingBuilding = containingLevel
    ? findAncestorOfType(data, containingLevel, 'building')
    : null
  const containingZones = findZonesInLevel(data, containingLevel)

  return {
    wallId,
    connectedWalls,
    openings,
    containingZones,
    containingLevel,
    containingBuilding,
  }
}

/**
 * List all walls impacted by a change to the given wall.
 */
export function listImpactedWalls(
  data: SceneData,
  wallId: string,
  patch: WallPatch,
  _scope?: ScopeOptions,
): ImpactEntry[] {
  const impacts: ImpactEntry[] = []

  const wall = data.nodes[wallId]
  if (!wall || wall.type !== 'wall') {
    impacts.push({
      category: 'invalid_topology',
      affectedIds: [wallId],
      description: `Wall ${wallId} not found or not a wall`,
      severity: 'error',
    })
    return impacts
  }

  // Check connected walls
  const connected = findConnectedWalls(data, wallId)
  if (connected.length > 0 && (patch.start || patch.end)) {
    impacts.push({
      category: 'connected_wall_endpoint',
      affectedIds: connected,
      description: `Moving endpoints affects ${connected.length} connected wall(s): ${connected.join(', ')}`,
      severity: 'warning',
    })
  }

  // Check openings on this wall
  const openings = findOpenings(data, wallId)
  if (openings.length > 0 && (patch.start || patch.end || patch.thickness)) {
    impacts.push({
      category: 'opening_bounds_violation',
      affectedIds: openings,
      description: `${openings.length} opening(s) on this wall may need adjustment: ${openings.join(', ')}`,
      severity: 'warning',
    })
  }

  // Check room boundaries
  const context = getWallImpactContext(data, wallId)
  if (context?.containingZones?.length && (patch.start || patch.end)) {
    impacts.push({
      category: 'room_boundary_change',
      affectedIds: context.containingZones,
      description: `Wall move affects zones: ${context.containingZones.join(', ')}`,
      severity: 'info',
    })
  }

  // Check exterior
  if (context?.containingLevel) {
    const wallData = wall as Record<string, unknown>
    if (wallData.frontSide === 'exterior' || wallData.backSide === 'exterior') {
      if (patch.start || patch.end) {
        impacts.push({
          category: 'exterior_perimeter_change',
          affectedIds: [wallId],
          description: 'This wall is part of the exterior perimeter',
          severity: 'warning',
        })
      }
    }
  }

  return impacts
}

/**
 * Simulate a wall change and return the result without modifying data.
 */
export function simulateWallChange(
  data: SceneData,
  wallId: string,
  patch: WallPatch,
  scope?: ScopeOptions,
): WallChangeResult {
  const impacts = listImpactedWalls(data, wallId, patch, scope)
  const errors = impacts.filter((i) => i.severity === 'error').map((i) => i.description)
  const warnings = impacts.filter((i) => i.severity === 'warning').map((i) => i.description)

  // Check if wall exists
  const wall = data.nodes[wallId]
  if (!wall || wall.type !== 'wall') {
    return {
      success: false,
      wallId,
      appliedPatch: patch,
      impacts,
      warnings,
      errors: [`Wall ${wallId} not found`, ...errors],
    }
  }

  // Check for opening bounds violations (would make opening fall outside wall)
  if (patch.start || patch.end) {
    const openingIssues = checkOpeningBoundsViolation(data, wallId, patch)
    if (openingIssues.length > 0) {
      errors.push(...openingIssues)
    }
  }

  return {
    success: errors.length === 0,
    wallId,
    appliedPatch: patch,
    impacts,
    warnings,
    errors,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function findConnectedWalls(data: SceneData, wallId: string): string[] {
  const wall = data.nodes[wallId]
  if (!wall) return []

  const wallStart = wall.start as [number, number] | undefined
  const wallEnd = wall.end as [number, number] | undefined
  if (!wallStart || !wallEnd) return []

  const threshold = 0.01 // 1cm tolerance
  const connected: string[] = []

  for (const [id, other] of Object.entries(data.nodes)) {
    if (id === wallId || other.type !== 'wall') continue

    const otherStart = other.start as [number, number] | undefined
    const otherEnd = other.end as [number, number] | undefined
    if (!otherStart || !otherEnd) continue

    // Check if any endpoint of this wall matches an endpoint of the other wall
    const startToStart = distance(wallStart, otherStart) < threshold
    const startToEnd = distance(wallStart, otherEnd) < threshold
    const endToStart = distance(wallEnd, otherStart) < threshold
    const endToEnd = distance(wallEnd, otherEnd) < threshold

    if (startToStart || startToEnd || endToStart || endToEnd) {
      connected.push(id)
    }
  }

  return connected
}

function findOpenings(data: SceneData, wallId: string): string[] {
  const openings: string[] = []
  for (const node of Object.values(data.nodes)) {
    if ((node.type === 'door' || node.type === 'window') && node.wallId === wallId) {
      openings.push(node.id)
    }
  }
  return openings
}

function findAncestorOfType(data: SceneData, nodeId: string, targetType: string): string | null {
  let current = nodeId
  let depth = 0
  const maxDepth = 20 // guard against cycles

  while (current && depth < maxDepth) {
    const node = data.nodes[current]
    if (!node) break
    if (node.type === targetType) return current
    current = node.parentId ?? ''
    depth++
  }
  return null
}

function findZonesInLevel(data: SceneData, levelId: string | null): string[] {
  if (!levelId) return []
  const level = data.nodes[levelId]
  if (!level || level.type !== 'level') return []

  const zones: string[] = []
  for (const childId of (level.children as string[]) ?? []) {
    const child = data.nodes[childId]
    if (child?.type === 'zone') {
      zones.push(child.id)
    }
  }
  return zones
}

function distance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

function checkOpeningBoundsViolation(data: SceneData, wallId: string, patch: WallPatch): string[] {
  const errors: string[] = []
  const wall = data.nodes[wallId]
  if (!wall) return errors

  const openings = findOpenings(data, wallId)
  if (openings.length === 0) return errors

  const wallStart = (patch.start ?? wall.start) as [number, number]
  const wallEnd = (patch.end ?? wall.end) as [number, number]
  const newLength = distance(wallStart, wallEnd)

  for (const openingId of openings) {
    const opening = data.nodes[openingId]
    if (!opening) continue

    const openingWidth = (opening.width as number) ?? 0.9
    if (openingWidth > newLength) {
      errors.push(
        `Opening ${openingId} (${opening.type}, width=${openingWidth.toFixed(2)}m) would exceed new wall length (${newLength.toFixed(2)}m)`,
      )
    }
  }

  return errors
}
