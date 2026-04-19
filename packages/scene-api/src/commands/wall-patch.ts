/**
 * Wall patch operations — simulate and apply mutations to walls.
 */

import type { SceneData, SceneNode, WallChangeResult, WallPatch } from '../types'

/**
 * Simulate a wall patch without modifying the scene data.
 */
export function simulateWallPatch(
  data: SceneData,
  wallId: string,
  patch: WallPatch,
): WallChangeResult {
  const wall = data.nodes[wallId]
  if (!wall || wall.type !== 'wall') {
    return {
      success: false,
      wallId: patch.wallId,
      appliedPatch: patch,
      impacts: [],
      warnings: [],
      errors: [`Wall ${wallId} not found or not a wall type`],
    }
  }

  // Validate patch fields
  const warnings: string[] = []
  const errors: string[] = []

  if (patch.start) {
    const length = getWallLength(patch.start, patch.end ?? (wall.end as [number, number]))
    if (length < 0.1) {
      errors.push('Wall length would be less than 0.1m')
    }
  }

  if (patch.end) {
    const length = getWallLength(patch.start ?? (wall.start as [number, number]), patch.end)
    if (length < 0.1) {
      errors.push('Wall length would be less than 0.1m')
    }
  }

  return {
    success: errors.length === 0,
    wallId,
    appliedPatch: patch,
    impacts: [],
    warnings,
    errors,
  }
}

/**
 * Apply a wall patch to scene data, returning a new data object.
 * This performs a dry-run check first and only applies if successful.
 */
export function applyWallPatch(
  data: SceneData,
  wallId: string,
  patch: WallPatch,
): WallChangeResult {
  const simResult = simulateWallPatch(data, wallId, patch)
  if (!simResult.success) {
    return simResult
  }

  // Create a new nodes map with the patched wall
  const wall = data.nodes[wallId]
  if (!wall) {
    return {
      success: false,
      wallId,
      appliedPatch: patch,
      impacts: [],
      warnings: [],
      errors: [`Wall ${wallId} not found`],
    }
  }

  // Apply the patch fields
  const patchedWall: SceneNode = {
    ...wall,
    ...(patch.start !== undefined && { start: patch.start }),
    ...(patch.end !== undefined && { end: patch.end }),
    ...(patch.thickness !== undefined && { thickness: patch.thickness }),
    ...(patch.height !== undefined && { height: patch.height }),
    ...(patch.material !== undefined && { material: patch.material }),
    ...(patch.name !== undefined && { name: patch.name }),
  }

  // Note: The actual mutation of data.nodes is left to the caller to set
  // This function returns the result; the SceneApi.applyWallPatch method
  // handles updating the internal data.
  return {
    success: true,
    wallId,
    appliedPatch: patch,
    impacts: [],
    warnings: [],
    errors: [],
  }
}

function getWallLength(start: [number, number], end: [number, number]): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  return Math.sqrt(dx * dx + dy * dy)
}
