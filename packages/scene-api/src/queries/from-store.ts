/**
 * Bridge from @pascal-app/core scene store to SceneApi data format.
 * This is the only file that imports from @pascal-app/core.
 */

import type { AnyNode } from '@pascal-app/core'
import type { SceneData, SceneNode } from '../types'

export function createSceneApiFromScene(
  nodes: Record<string, AnyNode>,
  rootNodeIds: string[],
): SceneData {
  const mappedNodes: Record<string, SceneNode> = {}

  for (const [id, node] of Object.entries(nodes)) {
    const result: SceneNode = {
      id: node.id,
      type: node.type,
      name: node.name,
      parentId: node.parentId,
    }

    // Pick up children from union members
    if ('children' in node && Array.isArray((node as Record<string, unknown>).children)) {
      result.children = (node as Record<string, unknown>).children as string[]
    }

    Object.assign(result, extractNodeFields(node))
    mappedNodes[id] = result
  }

  return { nodes: mappedNodes, rootNodeIds: [...rootNodeIds] }
}

function extractNodeFields(node: AnyNode): Record<string, unknown> {
  if (node.type === 'wall') {
    return {
      start: node.start,
      end: node.end,
      thickness: node.thickness,
      height: node.height,
      curveOffset: node.curveOffset,
      frontSide: node.frontSide,
      backSide: node.backSide,
      material: node.material,
      materialPreset: node.materialPreset,
    }
  }
  if (node.type === 'door') {
    return {
      position: node.position,
      rotation: node.rotation,
      side: node.side,
      wallId: node.wallId,
      width: node.width,
      height: node.height,
    }
  }
  if (node.type === 'window') {
    return {
      position: node.position,
      rotation: node.rotation,
      side: node.side,
      wallId: node.wallId,
      width: node.width,
      height: node.height,
    }
  }
  if (node.type === 'zone') {
    return {
      polygon: node.polygon,
      color: node.color,
    }
  }
  if (node.type === 'level') {
    return { level: node.level }
  }
  if (node.type === 'building') {
    return {
      position: node.position,
      rotation: node.rotation,
    }
  }
  if (node.type === 'site') {
    return { polygon: node.polygon }
  }
  return {}
}
