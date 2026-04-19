/**
 * Main SceneApi class.
 * Provides pure, typed access to scene state and mutations.
 * Operates on serializable data — no React or editor dependencies.
 */

import { diffSceneData } from './commands/diff'
import { applyWallPatch, simulateWallPatch } from './commands/wall-patch'
import { getWallImpactContext, listImpactedWalls, simulateWallChange } from './impact/wall-impact'
import type {
  ImpactEntry,
  NodeSummary,
  SceneData,
  SceneDiff,
  SceneNode,
  SceneSummary,
  ScopeOptions,
  ValidationIssue,
  WallChangeResult,
  WallImpactContext,
  WallInfo,
  WallPatch,
} from './types'
import { validateSceneData } from './validation/validate'

export class SceneApi {
  private data: SceneData

  constructor(data: SceneData) {
    this.data = data
  }

  // ─── Factory ───────────────────────────────────────────────────

  static fromData(data: SceneData): SceneApi {
    return new SceneApi(data)
  }

  // ─── Data Access ────────────────────────────────────────────────

  getData(): SceneData {
    return this.data
  }

  // ─── Queries ────────────────────────────────────────────────────

  getSceneSummary(scope?: ScopeOptions): SceneSummary {
    const filtered = this.filterByScope(scope)
    const nodes = Object.values(filtered.nodes)
    const stats = {
      sites: nodes.filter((n) => n.type === 'site').length,
      buildings: nodes.filter((n) => n.type === 'building').length,
      levels: nodes.filter((n) => n.type === 'level').length,
      walls: nodes.filter((n) => n.type === 'wall').length,
      windows: nodes.filter((n) => n.type === 'window').length,
      doors: nodes.filter((n) => n.type === 'door').length,
      zones: nodes.filter((n) => n.type === 'zone').length,
      items: nodes.filter((n) => n.type === 'item').length,
      slabs: nodes.filter((n) => n.type === 'slab').length,
      ceilings: nodes.filter((n) => n.type === 'ceiling').length,
      roofs: nodes.filter((n) => n.type === 'roof').length,
      stairs: nodes.filter((n) => n.type === 'stair').length,
      fences: nodes.filter((n) => n.type === 'fence').length,
      total: nodes.length,
    }
    return {
      rootNodeIds: filtered.rootNodeIds,
      nodes: nodes.map((n) => this.toNodeSummary(n)),
      stats,
    }
  }

  getNode(id: string): SceneNode | undefined {
    return this.data.nodes[id]
  }

  findNodes(query: { type?: string; name?: string; parentId?: string | null }): SceneNode[] {
    return Object.values(this.data.nodes).filter((node) => {
      if (query.type && node.type !== query.type) return false
      if (query.name && node.name !== query.name) return false
      if (query.parentId !== undefined && node.parentId !== query.parentId) return false
      return true
    })
  }

  inspectWall(id: string): WallInfo | undefined {
    const node = this.data.nodes[id]
    if (!node || node.type !== 'wall') return undefined
    return this.toWallInfo(node)
  }

  // ─── Impact ─────────────────────────────────────────────────────

  getWallImpactContext(wallId: string): WallImpactContext | undefined {
    return getWallImpactContext(this.data, wallId)
  }

  listImpactedWalls(wallId: string, patch: WallPatch, scope?: ScopeOptions): ImpactEntry[] {
    return listImpactedWalls(this.data, wallId, patch, scope)
  }

  simulateWallChange(wallId: string, patch: WallPatch, scope?: ScopeOptions): WallChangeResult {
    return simulateWallChange(this.data, wallId, patch, scope)
  }

  // ─── Mutations ──────────────────────────────────────────────────

  simulateWallPatch(wallId: string, patch: WallPatch): WallChangeResult {
    return simulateWallPatch(this.data, wallId, patch)
  }

  applyWallPatch(wallId: string, patch: WallPatch): WallChangeResult {
    const result = applyWallPatch(this.data, wallId, patch)
    this.data = result.success ? { ...this.data, nodes: { ...this.data.nodes } } : this.data
    return result
  }

  // ─── Validation ─────────────────────────────────────────────────

  validateScene(scope?: ScopeOptions): ValidationIssue[] {
    const filtered = this.filterByScope(scope)
    return validateSceneData(filtered)
  }

  // ─── Diff / Undo ────────────────────────────────────────────────

  diffScene(checkpoint: SceneData): SceneDiff {
    return diffSceneData(checkpoint, this.data)
  }

  // ─── Internals ──────────────────────────────────────────────────

  private filterByScope(scope?: ScopeOptions): SceneData {
    if (!scope) return this.data

    const { levelId, buildingId, siteId } = scope
    const allNodes = Object.values(this.data.nodes)

    // Find the scope root
    let scopeRoot: string | undefined
    if (levelId) {
      scopeRoot = levelId
    } else if (buildingId) {
      scopeRoot = buildingId
    } else if (siteId) {
      scopeRoot = siteId
    }

    if (!scopeRoot) return this.data

    // Collect all descendants
    const included = new Set<string>()
    const queue = [scopeRoot]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (included.has(current)) continue
      included.add(current)
      const node = this.data.nodes[current]
      if (node?.children) {
        for (const childId of node.children) {
          queue.push(childId)
        }
      }
    }

    // Also include ancestors up to root
    for (const nodeId of [...included]) {
      let parent = this.data.nodes[nodeId]?.parentId
      while (parent) {
        included.add(parent)
        parent = this.data.nodes[parent]?.parentId
      }
    }

    const filteredNodes: Record<string, SceneNode> = {}
    for (const id of included) {
      const node = this.data.nodes[id]
      if (node) filteredNodes[id] = node
    }

    const filteredRootIds = this.data.rootNodeIds.filter((id) => included.has(id))

    return { nodes: filteredNodes, rootNodeIds: filteredRootIds }
  }

  private toNodeSummary(node: SceneNode): NodeSummary {
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      parentId: node.parentId,
      children: (node.children as string[]) ?? [],
    }
  }

  private toWallInfo(node: SceneNode): WallInfo {
    const start = (node.start as [number, number]) ?? [0, 0]
    const end = (node.end as [number, number]) ?? [0, 0]
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    return {
      id: node.id,
      name: node.name,
      start,
      end,
      thickness: node.thickness as number | undefined,
      height: node.height as number | undefined,
      material: node.materialPreset as string | undefined,
      frontSide: (node.frontSide as string) ?? 'unknown',
      backSide: (node.backSide as string) ?? 'unknown',
      children: (node.children as string[]) ?? [],
      parentId: node.parentId,
      length,
      angle,
    }
  }
}
