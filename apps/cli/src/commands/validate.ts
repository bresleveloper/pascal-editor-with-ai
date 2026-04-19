/**
 * Validate a scene.
 */

import { kitchenFixture, SceneApi } from '@pascal/scene-api'

export async function validate(options: { scene?: string; scope?: string; json?: boolean }) {
  const sceneData = loadScene(options.scene)
  const sceneApi = SceneApi.fromData(sceneData)

  const issues = sceneApi.validateScene()
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  if (options.json) {
    console.log(
      JSON.stringify({ issues, errorCount: errors.length, warningCount: warnings.length }, null, 2),
    )
  } else {
    if (issues.length === 0) {
      console.log('✅ Scene is valid — no issues found.')
    } else {
      console.log(
        `Found ${issues.length} issue(s): ${errors.length} error(s), ${warnings.length} warning(s)`,
      )
      for (const issue of issues) {
        const icon = issue.level === 'error' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️'
        console.log(
          `  ${icon} [${issue.code}] ${issue.message}${issue.nodeId ? ` (node: ${issue.nodeId})` : ''}`,
        )
      }
    }
  }

  if (errors.length > 0) {
    process.exit(1)
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
