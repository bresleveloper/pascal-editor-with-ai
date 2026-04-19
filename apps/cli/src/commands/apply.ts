/**
 * Apply a plan from a JSON file.
 */

import type { Plan } from '@pascal/agent-core'
import { createSceneTools, Executor, ToolRegistry } from '@pascal/agent-core'
import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function apply(planPath: string, options: { scene?: string; json?: boolean }) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)

  // Create tool registry
  const toolRegistry = new ToolRegistry()
  for (const tool of createSceneTools(sceneApi)) {
    toolRegistry.register(tool)
  }

  // Load plan
  let plan: Plan
  try {
    const fs = require('node:fs')
    plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'))
  } catch (error) {
    console.error(`Failed to load plan from ${planPath}: ${error}`)
    process.exit(1)
  }

  // Execute plan
  const executor = new Executor(toolRegistry)
  const result = await executor.execute(plan)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (result.success) {
      console.log('✅ Plan applied successfully')
    } else {
      console.log('❌ Plan application failed')
    }
    for (const { step, result: stepResult } of result.steps) {
      const icon = stepResult.success ? '✅' : '❌'
      console.log(`  ${icon} ${step.name}`)
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
