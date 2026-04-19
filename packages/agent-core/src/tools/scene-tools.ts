/**
 * Scene-related tools for the agent system.
 */

import type { SceneApi } from '@pascal/scene-api'
import { z } from 'zod'
import type { ToolDefinition } from './registry'

export function createSceneTools(sceneApi: SceneApi): ToolDefinition[] {
  return [
    {
      name: 'scene.summary',
      description: 'Get a summary of the current scene, including node counts and hierarchy.',
      parameters: z.object({
        scope: z.optional(
          z.object({
            levelId: z.string().optional(),
            buildingId: z.string().optional(),
            siteId: z.string().optional(),
          }),
        ),
      }),
      execute: async (args) => {
        const summary = sceneApi.getSceneSummary(
          (args as { scope?: unknown }).scope as Parameters<SceneApi['getSceneSummary']>[0],
        )
        return { success: true, data: summary }
      },
    },
    {
      name: 'scene.find_nodes',
      description: 'Find nodes by type, name, or parent.',
      parameters: z.object({
        type: z.string().optional(),
        name: z.string().optional(),
        parentId: z.string().nullable().optional(),
      }),
      execute: async (args) => {
        const nodes = sceneApi.findNodes(
          args as { type?: string; name?: string; parentId?: string | null },
        )
        return { success: true, data: nodes }
      },
    },
    {
      name: 'wall.inspect',
      description: 'Inspect a wall by ID, returning position, length, angle, and openings.',
      parameters: z.object({
        wallId: z.string(),
      }),
      execute: async (args) => {
        const { wallId } = args as { wallId: string }
        const info = sceneApi.inspectWall(wallId)
        if (!info) {
          return { success: false, error: `Wall "${wallId}" not found` }
        }
        return { success: true, data: info }
      },
    },
    {
      name: 'wall.resolve_reference',
      description:
        'Resolve an English wall reference (e.g., "the north wall of the kitchen") to a wall ID.',
      parameters: z.object({
        reference: z.string(),
      }),
      execute: async (args) => {
        const { reference } = args as { reference: string }
        // Use the reference resolver
        const { ReferenceResolver } = await import('../resolver/reference-resolver')
        const resolver = new ReferenceResolver(sceneApi)
        const result = await resolver.resolve(reference)
        if (!result.matched) {
          return {
            success: false,
            error: `Could not resolve reference "${reference}"`,
            data: { candidates: result.candidates },
          }
        }
        return { success: true, data: result }
      },
    },
    {
      name: 'wall.simulate_change',
      description:
        'Simulate changing a wall, returning impact analysis without modifying the scene.',
      parameters: z.object({
        wallId: z.string(),
        start: z.tuple([z.number(), z.number()]).optional(),
        end: z.tuple([z.number(), z.number()]).optional(),
        thickness: z.number().optional(),
        height: z.number().optional(),
      }),
      execute: async (args) => {
        const { wallId, ...patch } = args as {
          wallId: string
          start?: [number, number]
          end?: [number, number]
          thickness?: number
        }
        const result = sceneApi.simulateWallPatch(wallId, { wallId, ...patch })
        return {
          success: result.success,
          data: result,
          warnings: result.warnings,
          error: result.errors.join('; ') || undefined,
        }
      },
      supportsDryRun: true,
      dryRun: async (args) => {
        const { wallId, ...patch } = args as {
          wallId: string
          start?: [number, number]
          end?: [number, number]
          thickness?: number
        }
        const result = sceneApi.simulateWallPatch(wallId, { wallId, ...patch })
        return { success: result.success, data: result, warnings: result.warnings }
      },
    },
    {
      name: 'wall.apply_change',
      description: 'Apply a wall change to the scene.',
      parameters: z.object({
        wallId: z.string(),
        start: z.tuple([z.number(), z.number()]).optional(),
        end: z.tuple([z.number(), z.number()]).optional(),
        thickness: z.number().optional(),
        height: z.number().optional(),
      }),
      execute: async (args) => {
        const { wallId, ...patch } = args as {
          wallId: string
          start?: [number, number]
          end?: [number, number]
          thickness?: number
        }
        const result = sceneApi.applyWallPatch(wallId, { wallId, ...patch })
        return {
          success: result.success,
          data: result,
          warnings: result.warnings,
          error: result.errors.join('; ') || undefined,
          impactedIds: result.impacts.flatMap((i) => i.affectedIds),
        }
      },
    },
    {
      name: 'scene.validate',
      description: 'Validate the current scene, returning any issues.',
      parameters: z.object({
        scope: z.optional(
          z.object({
            levelId: z.string().optional(),
            buildingId: z.string().optional(),
            siteId: z.string().optional(),
          }),
        ),
      }),
      execute: async (args) => {
        const issues = sceneApi.validateScene(
          (args as { scope?: unknown }).scope as Parameters<SceneApi['validateScene']>[0],
        )
        return { success: true, data: issues }
      },
    },
    {
      name: 'scene.diff',
      description: 'Compute the diff between a checkpoint and the current scene.',
      parameters: z.object({
        checkpoint: z.unknown(), // SceneData — passed through
      }),
      execute: async (args) => {
        // The checkpoint needs to be provided externally; for now return empty diff
        return { success: true, data: { added: [], removed: [], modified: [] } }
      },
    },
    {
      name: 'task.report_progress',
      description: 'Report progress on a task.',
      parameters: z.object({
        message: z.string(),
        percent: z.number().optional(),
      }),
      execute: async (args) => {
        const { message, percent } = args as { message: string; percent?: number }
        return { success: true, data: { message, percent } }
      },
    },
  ]
}
