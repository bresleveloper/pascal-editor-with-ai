/**
 * Scene validation — checks for geometry and topology issues.
 */

import type { SceneData, ValidationIssue } from '../types'

export function validateSceneData(data: SceneData): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check for orphan nodes
  for (const [id, node] of Object.entries(data.nodes)) {
    if (node.parentId && !data.nodes[node.parentId]) {
      issues.push({
        level: 'error',
        code: 'orphan_node',
        message: `Node ${id} has parentId ${node.parentId} that does not exist`,
        nodeId: id,
      })
    }
  }

  // Check for dangling children references
  for (const [id, node] of Object.entries(data.nodes)) {
    const children = (node.children as string[]) ?? []
    for (const childId of children) {
      if (!data.nodes[childId]) {
        issues.push({
          level: 'error',
          code: 'dangling_child',
          message: `Node ${id} references child ${childId} that does not exist`,
          nodeId: id,
        })
      }
    }
  }

  // Check for zero-length walls
  for (const [id, node] of Object.entries(data.nodes)) {
    if (node.type === 'wall') {
      const start = node.start as [number, number] | undefined
      const end = node.end as [number, number] | undefined
      if (start && end) {
        const dx = end[0] - start[0]
        const dy = end[1] - start[1]
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length < 0.01) {
          issues.push({
            level: 'error',
            code: 'zero_length_wall',
            message: `Wall ${id} has zero length (start=${start}, end=${end})`,
            nodeId: id,
          })
        }
        if (length < 0.1) {
          issues.push({
            level: 'warning',
            code: 'very_short_wall',
            message: `Wall ${id} is very short (${length.toFixed(3)}m)`,
            nodeId: id,
          })
        }
      }
    }
  }

  // Check for negative height/thickness
  for (const [id, node] of Object.entries(data.nodes)) {
    if (node.type === 'wall') {
      if (typeof node.thickness === 'number' && node.thickness < 0) {
        issues.push({
          level: 'error',
          code: 'negative_thickness',
          message: `Wall ${id} has negative thickness`,
          nodeId: id,
        })
      }
      if (typeof node.height === 'number' && node.height < 0) {
        issues.push({
          level: 'error',
          code: 'negative_height',
          message: `Wall ${id} has negative height`,
          nodeId: id,
        })
      }
    }
  }

  // Check that root nodes exist
  for (const rootId of data.rootNodeIds) {
    if (!data.nodes[rootId]) {
      issues.push({
        level: 'error',
        code: 'missing_root',
        message: `Root node ${rootId} referenced but not found`,
      })
    }
  }

  // Check zones have valid polygons
  for (const [id, node] of Object.entries(data.nodes)) {
    if (node.type === 'zone') {
      const polygon = node.polygon as [number, number][] | undefined
      if (polygon && polygon.length < 3) {
        issues.push({
          level: 'error',
          code: 'invalid_zone_polygon',
          message: `Zone ${id} has a polygon with less than 3 points`,
          nodeId: id,
        })
      }
    }
  }

  return issues
}
