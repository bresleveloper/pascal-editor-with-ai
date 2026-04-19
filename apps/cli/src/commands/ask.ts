/**
 * Ask the agent to make a scene edit.
 */

import { createSceneTools, Executor, Planner, ToolRegistry } from '@pascal/agent-core'
import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function ask(
  prompt: string,
  options: {
    scene?: string
    dryRun?: boolean
    provider?: string
    profile?: string
    json?: boolean
  },
) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)

  // Create tool registry
  const toolRegistry = new ToolRegistry()
  for (const tool of createSceneTools(sceneApi)) {
    toolRegistry.register(tool)
  }

  // Create plan
  const planner = new Planner()
  const plan = planner.createPlan({ userRequest: prompt })

  if (options.dryRun) {
    if (options.json) {
      console.log(JSON.stringify({ plan, dryRun: true }, null, 2))
    } else {
      console.log('📋 Dry Run - Plan:')
      console.log(`   Intent: ${plan.intent}`)
      console.log(`   Steps: ${plan.steps.length}`)
      for (const step of plan.steps) {
        console.log(`     ${step.dryRun ? '🔍' : '✏️'} ${step.name}: ${step.description}`)
      }
      if (plan.risks.length > 0) {
        console.log('   Risks:')
        for (const risk of plan.risks) {
          console.log(`     ⚠️ ${risk}`)
        }
      }
      if (plan.needsConfirmation) {
        console.log('   ⚠️ This action needs confirmation before applying.')
      }
    }
    return
  }

  // Execute plan
  const executor = new Executor(toolRegistry)
  const result = await executor.execute(plan)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (result.success) {
      console.log('✅ Plan executed successfully')
    } else {
      console.log('❌ Plan execution failed')
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    }
    for (const { step, result: stepResult } of result.steps) {
      const icon = stepResult.success ? '✅' : '❌'
      console.log(`  ${icon} ${step.name}`)
      if (!stepResult.success && stepResult.error) {
        console.log(`     Error: ${stepResult.error}`)
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
