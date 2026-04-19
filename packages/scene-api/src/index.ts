/**
 * @pascal/scene-api
 * Pure typed domain API over scene state and scene mutations.
 */

export { SceneApi } from './api'
export {
  complexWallFixture,
  createEmptyScene,
  createMinimalScene,
  kitchenFixture,
  multiLevelFixture,
} from './fixtures/index'

export { createSceneApiFromScene } from './queries/from-store'
export type {
  ImpactCategory,
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
