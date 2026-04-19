import type { SceneData, SceneNode } from '../types'

function id(prefix: string, n: number): string {
  return `${prefix}_${n}`
}

/**
 * Kitchen scene: L-shaped kitchen with two walls, a window, and a zone.
 */
export function kitchenFixture(): SceneData {
  const wallNorthId = 'wall_kitchen_north'
  const wallWestId = 'wall_kitchen_west'
  const windowId = 'window_kitchen_north'
  const zoneId = 'zone_kitchen'
  const levelId = 'level_kitchen'
  const buildingId = 'building_kitchen'
  const siteId = 'site_kitchen'

  const wallNorth: SceneNode = {
    id: wallNorthId,
    type: 'wall',
    parentId: levelId,
    children: [windowId],
    name: 'North Wall',
    start: [0, 0],
    end: [4, 0],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const wallWest: SceneNode = {
    id: wallWestId,
    type: 'wall',
    parentId: levelId,
    children: [],
    name: 'West Wall',
    start: [0, 0],
    end: [0, 3],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const window: SceneNode = {
    id: windowId,
    type: 'window',
    parentId: wallNorthId,
    wallId: wallNorthId,
    position: [2, 1.4, 0],
    rotation: [0, 0, 0],
    width: 1.5,
    height: 1.2,
  }

  const zone: SceneNode = {
    id: zoneId,
    type: 'zone',
    parentId: levelId,
    name: 'Kitchen',
    polygon: [
      [0.1, 0.1],
      [3.9, 0.1],
      [3.9, 2.9],
      [0.1, 2.9],
    ],
    color: '#3b82f6',
  }

  const level: SceneNode = {
    id: levelId,
    type: 'level',
    parentId: buildingId,
    children: [wallNorthId, wallWestId, windowId, zoneId],
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
        [-10, -10],
        [10, -10],
        [10, 10],
        [-10, 10],
      ],
    },
  }

  return {
    rootNodeIds: [siteId],
    nodes: {
      [siteId]: site,
      [buildingId]: building,
      [levelId]: level,
      [wallNorthId]: wallNorth,
      [wallWestId]: wallWest,
      [windowId]: window,
      [zoneId]: zone,
    },
  }
}

/**
 * Multi-level scene with two levels.
 */
export function multiLevelFixture(): SceneData {
  const level0 = 'level_ground_floor'
  const level1 = 'level_first_floor'
  const buildingId = 'building_house'
  const siteId = 'site_house'

  const wallL0W1 = 'wall_l0_w1'
  const wallL0W2 = 'wall_l0_w2'
  const wallL1W1 = 'wall_l1_w1'

  const wall_L0_W1: SceneNode = {
    id: wallL0W1,
    type: 'wall',
    parentId: level0,
    children: [],
    start: [0, 0],
    end: [6, 0],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const wall_L0_W2: SceneNode = {
    id: wallL0W2,
    type: 'wall',
    parentId: level0,
    children: [],
    start: [6, 0],
    end: [6, 4],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'interior',
  }

  const wall_L1_W1: SceneNode = {
    id: wallL1W1,
    type: 'wall',
    parentId: level1,
    children: [],
    start: [0, 0],
    end: [6, 0],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const level0Node: SceneNode = {
    id: level0,
    type: 'level',
    parentId: buildingId,
    children: [wallL0W1, wallL0W2],
    level: 0,
  }

  const level1Node: SceneNode = {
    id: level1,
    type: 'level',
    parentId: buildingId,
    children: [wallL1W1],
    level: 1,
  }

  const building: SceneNode = {
    id: buildingId,
    type: 'building',
    parentId: siteId,
    children: [level0, level1],
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
      [level0]: level0Node,
      [level1]: level1Node,
      [wallL0W1]: wall_L0_W1,
      [wallL0W2]: wall_L0_W2,
      [wallL1W1]: wall_L1_W1,
    },
  }
}

/**
 * Complex wall configuration with T-junctions.
 */
export function complexWallFixture(): SceneData {
  const levelId = 'level_complex'
  const buildingId = 'building_complex'
  const siteId = 'site_complex'

  const wallH1 = 'wall_h1'
  const wallH2 = 'wall_h2'
  const wallV = 'wall_v'

  const wH1: SceneNode = {
    id: wallH1,
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

  const wH2: SceneNode = {
    id: wallH2,
    type: 'wall',
    parentId: levelId,
    children: [],
    start: [5, 0],
    end: [10, 0],
    thickness: 0.2,
    height: 2.8,
    frontSide: 'interior',
    backSide: 'exterior',
  }

  const wV: SceneNode = {
    id: wallV,
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
    children: [wallH1, wallH2, wallV],
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
      [wallH1]: wH1,
      [wallH2]: wH2,
      [wallV]: wV,
    },
  }
}
