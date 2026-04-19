/**
 * Scene diff — compute differences between two scene snapshots.
 */

import type { SceneData, SceneDiff, SceneNode } from '../types'

export function diffSceneData(from: SceneData, to: SceneData): SceneDiff {
  const added: string[] = []
  const removed: string[] = []
  const modified: SceneDiff['modified'] = []

  const fromIds = new Set(Object.keys(from.nodes))
  const toIds = new Set(Object.keys(to.nodes))

  // Added nodes
  for (const id of toIds) {
    if (!fromIds.has(id)) {
      added.push(id)
    }
  }

  // Removed nodes
  for (const id of fromIds) {
    if (!toIds.has(id)) {
      removed.push(id)
    }
  }

  // Modified nodes — compare field by field
  for (const id of fromIds) {
    if (!toIds.has(id)) continue
    const fromNode = from.nodes[id]
    const toNode = to.nodes[id]
    if (!fromNode || !toNode) continue

    const allKeys = new Set([...Object.keys(fromNode), ...Object.keys(toNode)])
    for (const key of allKeys) {
      const oldVal = fromNode[key as keyof SceneNode]
      const newVal = toNode[key as keyof SceneNode]

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        modified.push({
          id,
          field: key,
          oldValue: oldVal,
          newValue: newVal,
        })
      }
    }
  }

  return { added, removed, modified }
}
