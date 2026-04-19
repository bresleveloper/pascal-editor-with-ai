/**
 * Resolve an English wall reference to a wall ID.
 */

import { ReferenceResolver } from '@pascal/agent-core'
import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function resolve(reference: string, options: { scene?: string; json?: boolean }) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)
  const resolver = new ReferenceResolver(sceneApi)

  const result = await resolver.resolve(reference)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (result.matched) {
      console.log(`✅ Resolved: "${reference}" → ${result.wallId}`)
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`)
      console.log(`   Reason: ${result.reason}`)
      if (result.ambiguity) {
        console.log(`   ⚠️ Ambiguous match. Other candidates:`)
        for (const c of result.candidates.slice(1)) {
          console.log(`     - ${c.wallId} (${(c.confidence * 100).toFixed(0)}%): ${c.reason}`)
        }
      }
    } else {
      console.log(`❌ Could not resolve: "${reference}"`)
      if (result.candidates.length > 0) {
        console.log('   Candidates:')
        for (const c of result.candidates) {
          console.log(`     - ${c.wallId} (${(c.confidence * 100).toFixed(0)}%): ${c.reason}`)
        }
      }
    }
  }
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
