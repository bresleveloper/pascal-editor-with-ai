/**
 * Core types for the Scene API.
 * These are pure data types — no React, no editor state — suitable for
 * use by the agent system, CLI, and tests.
 */

// Types are defined in this file, no separate module needed

// ─── Scope ────────────────────────────────────────────────────────

export interface ScopeOptions {
  /** Only inspect/modify nodes within this level */
  levelId?: string
  /** Only inspect/modify nodes within this building */
  buildingId?: string
  /** Only inspect/modify nodes within this site */
  siteId?: string
}

// ─── Queries ──────────────────────────────────────────────────────

export interface NodeSummary {
  id: string
  type: string
  name?: string
  parentId: string | null
  children: string[]
}

export interface SceneSummary {
  rootNodeIds: string[]
  nodes: NodeSummary[]
  stats: {
    sites: number
    buildings: number
    levels: number
    walls: number
    windows: number
    doors: number
    zones: number
    items: number
    slabs: number
    ceilings: number
    roofs: number
    stairs: number
    fences: number
    total: number
  }
}

export interface WallInfo {
  id: string
  name?: string
  start: [number, number]
  end: [number, number]
  thickness?: number
  height?: number
  material?: string
  frontSide: string
  backSide: string
  children: string[]
  parentId: string | null
  length: number
  angle: number // radians
}

// ─── Impact ───────────────────────────────────────────────────────

export interface WallImpactContext {
  wallId: string
  connectedWalls: string[]
  openings: string[] // windows and doors on this wall
  containingZones: string[]
  containingLevel: string | null
  containingBuilding: string | null
}

export type ImpactCategory =
  | 'connected_wall_endpoint'
  | 'opening_bounds_violation'
  | 'room_boundary_change'
  | 'exterior_perimeter_change'
  | 'collision'
  | 'intersection'
  | 'invalid_topology'
  | 'downstream_regeneration'

export interface ImpactEntry {
  category: ImpactCategory
  affectedIds: string[]
  description: string
  severity: 'info' | 'warning' | 'error'
}

// ─── Mutations ───────────────────────────────────────────────────

export interface WallPatch {
  wallId: string
  start?: [number, number]
  end?: [number, number]
  thickness?: number
  height?: number
  material?: string
  name?: string
}

export interface WallChangeResult {
  success: boolean
  wallId: string
  appliedPatch: WallPatch
  impacts: ImpactEntry[]
  warnings: string[]
  errors: string[]
}

// ─── Validation ──────────────────────────────────────────────────

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
  nodeId?: string
  details?: Record<string, unknown>
}

// ─── Diff ────────────────────────────────────────────────────────

export interface SceneDiff {
  added: string[]
  removed: string[]
  modified: Array<{
    id: string
    field: string
    oldValue: unknown
    newValue: unknown
  }>
}

// ─── Scene types bridge ──────────────────────────────────────────

/**
 * Bridge type so scene-api can work with node types without a direct
 * runtime dependency on @pascal-app/core.
 * Consumers provide actual nodes, and we consume them through this interface.
 */
export interface SceneNode {
  id: string
  type: string
  name?: string
  parentId: string | null
  children?: string[]
  [key: string]: unknown
}

export interface SceneData {
  nodes: Record<string, SceneNode>
  rootNodeIds: string[]
}
