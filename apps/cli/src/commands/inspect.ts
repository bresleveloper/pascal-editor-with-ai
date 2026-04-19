/**
 * Inspect a wall by ID.
 */

import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function inspect(id: string, options: { scene?: string; json?: boolean }) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)

  // First try wall inspect
  const wallInfo = sceneApi.inspectWall(id)
  if (wallInfo) {
    if (options.json) {
      console.log(JSON.stringify(wallInfo, null, 2))
    } else {
      console.log(`🧱 Wall: ${wallInfo.id}`)
      if (wallInfo.name) console.log(`   Name: ${wallInfo.name}`)
      console.log(`   Start: (${wallInfo.start[0].toFixed(2)}, ${wallInfo.start[1].toFixed(2)})`)
      console.log(`   End: (${wallInfo.end[0].toFixed(2)}, ${wallInfo.end[1].toFixed(2)})`)
      console.log(`   Length: ${wallInfo.length.toFixed(2)}m`)
      console.log(`   Angle: ${((wallInfo.angle * 180) / Math.PI).toFixed(1)}°`)
      console.log(`   Thickness: ${wallInfo.thickness?.toFixed(2) ?? 'default'}m`)
      console.log(`   Height: ${wallInfo.height?.toFixed(2) ?? 'default'}m`)
      console.log(`   Front: ${wallInfo.frontSide}`)
      console.log(`   Back: ${wallInfo.backSide}`)
      console.log(`   Openings: ${wallInfo.children.length}`)
    }
    return
  }

  // Try any node
  const node = sceneApi.getNode(id)
  if (node) {
    if (options.json) {
      console.log(JSON.stringify(node, null, 2))
    } else {
      console.log(`📦 Node: ${node.id}`)
      console.log(`   Type: ${node.type}`)
      if (node.name) console.log(`   Name: ${node.name}`)
      console.log(`   Parent: ${node.parentId ?? 'none'}`)
      console.log(`   Children: ${(node.children as string[])?.length ?? 0}`)
    }
    return
  }

  console.error(`❌ Node "${id}" not found`)
  process.exit(1)
}

function loadScene(path?: string) {
  if (path) {
    try {
      const fs = require('node:fs')
      return JSON.parse(fs.readFileSync(path, 'utf-8'))
    } catch {
      console.error(`Failed to load scene from ${path}, using default`)
    }
  }
  return kitchenFixture()
}
