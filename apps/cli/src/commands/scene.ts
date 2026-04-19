/**
 * Scene — scene operations.
 */

import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function scene(action: string, options: { scene?: string; json?: boolean }) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)

  if (action === 'summary') {
    const summary = sceneApi.getSceneSummary()

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log('📊 Scene Summary')
      console.log(`  Sites:      ${summary.stats.sites}`)
      console.log(`  Buildings:  ${summary.stats.buildings}`)
      console.log(`  Levels:     ${summary.stats.levels}`)
      console.log(`  Walls:      ${summary.stats.walls}`)
      console.log(`  Windows:    ${summary.stats.windows}`)
      console.log(`  Doors:      ${summary.stats.doors}`)
      console.log(`  Zones:      ${summary.stats.zones}`)
      console.log(`  Items:      ${summary.stats.items}`)
      console.log(`  Total nodes: ${summary.stats.total}`)
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
