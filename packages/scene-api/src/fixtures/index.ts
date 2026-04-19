/**
 * Test fixtures — pre-built scene data for testing.
 */

import type { SceneData, SceneNode } from '../types'

/**
 * Create a minimal valid scene with a site → building → level.
 */
export function createMinimalScene(): SceneData {
  const wall1Id = 'wall_test1'
  const wall2Id = 'wall_test2'
  const levelId = 'level_test1'
  const buildingId = 'building_test1'
  const siteId = 'site_test1'

  const wall1: SceneNode = {
    id: wall1Id,
    type: 'wall',
    parentId: levelId,
    children: [],
    start: [0, 0],
    end: [5, 0],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const wall2: SceneNode = {
    id: wall2Id,
    type: 'wall',
    parentId: levelId,
    children: [],
    start: [5, 0],
    end: [5, 4],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'interior',
  }

  const level: SceneNode = {
    id: levelId,
    type: 'level',
    parentId: buildingId,
    children: [wall1Id, wall2Id],
    level: 0,
  }

  const building: SceneNode = {
    id: buildingId,
    type: 'building',
    parentId: siteId,
    children: [levelId],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  }

  const site: SceneNode = {
    id: siteId,
    type: 'site',
    parentId: null,
    children: [buildingId],
    polygon: {
      type: 'polygon',
      points: [
        [-15, -15],
        [15, -15],
        [15, 15],
        [-15, 15],
      ],
    },
  }

  return {
    rootNodeIds: [siteId],
    nodes: {
      [siteId]: site,
      [buildingId]: building,
      [levelId]: level,
      [wall1Id]: wall1,
      [wall2Id]: wall2,
    },
  }
}

/**
 * Create an empty scene.
 */
export function createEmptyScene(): SceneData {
  return { rootNodeIds: [], nodes: {} }
}

export { complexWallFixture, kitchenFixture, multiLevelFixture } from './scenes'
