import { describe, expect, test } from 'bun:test'
import { SceneApi } from '../api'
import { createEmptyScene, createMinimalScene } from '../fixtures/index'
import { complexWallFixture, kitchenFixture } from '../fixtures/scenes'

describe('SceneApi', () => {
  describe('getSceneSummary', () => {
    test('returns summary of minimal scene', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const summary = api.getSceneSummary()

      expect(summary.stats.sites).toBe(1)
      expect(summary.stats.buildings).toBe(1)
      expect(summary.stats.levels).toBe(1)
      expect(summary.stats.walls).toBe(2)
      expect(summary.stats.total).toBe(5)
    })

    test('returns empty summary for empty scene', () => {
      const api = SceneApi.fromData(createEmptyScene())
      const summary = api.getSceneSummary()

      expect(summary.stats.total).toBe(0)
      expect(summary.nodes).toHaveLength(0)
    })

    test('returns correct counts for kitchen fixture', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const summary = api.getSceneSummary()

      expect(summary.stats.walls).toBe(2)
      expect(summary.stats.windows).toBe(1)
      expect(summary.stats.zones).toBe(1)
    })
  })

  describe('getNode', () => {
    test('returns a node by id', () => {
      const data = createMinimalScene()
      const api = SceneApi.fromData(data)

      const wall = api.getNode('wall_test1')
      expect(wall).toBeDefined()
      expect(wall?.type).toBe('wall')
      expect(wall?.start).toEqual([0, 0])
    })

    test('returns undefined for missing node', () => {
      const api = SceneApi.fromData(createMinimalScene())
      expect(api.getNode('nonexistent')).toBeUndefined()
    })
  })

  describe('findNodes', () => {
    test('finds nodes by type', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const walls = api.findNodes({ type: 'wall' })
      expect(walls).toHaveLength(2)
    })

    test('finds nodes by name', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const north = api.findNodes({ name: 'North Wall' })
      expect(north).toHaveLength(1)
      expect(north[0].id).toBe('wall_kitchen_north')
    })

    test('returns empty for no matches', () => {
      const api = SceneApi.fromData(createEmptyScene())
      const walls = api.findNodes({ type: 'wall' })
      expect(walls).toHaveLength(0)
    })
  })

  describe('inspectWall', () => {
    test('returns wall info with computed length and angle', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const wallInfo = api.inspectWall('wall_test1')

      expect(wallInfo).toBeDefined()
      expect(wallInfo?.start).toEqual([0, 0])
      expect(wallInfo?.end).toEqual([5, 0])
      expect(wallInfo?.length).toBeCloseTo(5)
      expect(wallInfo?.angle).toBeCloseTo(0)
    })

    test('returns undefined for non-wall', () => {
      const api = SceneApi.fromData(createMinimalScene())
      expect(api.inspectWall('level_test1')).toBeUndefined()
    })
  })

  describe('getWallImpactContext', () => {
    test('finds connected walls at T-junction', () => {
      const api = SceneApi.fromData(complexWallFixture())
      const context = api.getWallImpactContext('wall_v')

      expect(context).toBeDefined()
      expect(context?.wallId).toBe('wall_v')
      // wall_v starts at (5,0) which is shared by wall_h1's end and wall_h2's start
      expect(context?.connectedWalls).toHaveLength(2)
    })

    test('finds window on wall', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const context = api.getWallImpactContext('wall_kitchen_north')

      expect(context).toBeDefined()
      expect(context?.openings).toContain('window_kitchen_north')
    })

    test('finds containing level and building', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const context = api.getWallImpactContext('wall_kitchen_north')

      expect(context?.containingLevel).toBe('level_kitchen')
      expect(context?.containingBuilding).toBe('building_kitchen')
    })
  })

  describe('simulateWallChange', () => {
    test('detects connected wall impact', () => {
      const api = SceneApi.fromData(complexWallFixture())
      const result = api.simulateWallChange('wall_h1', {
        wallId: 'wall_h1',
        end: [6, 0], // move endpoint
      })

      expect(result.impacts.some((i) => i.category === 'connected_wall_endpoint')).toBe(true)
    })

    test('detects opening impact', () => {
      const api = SceneApi.fromData(kitchenFixture())
      const result = api.simulateWallChange('wall_kitchen_north', {
        wallId: 'wall_kitchen_north',
        start: [1, 0], // shrink wall, making opening potentially overhang
      })

      expect(result.impacts.some((i) => i.category === 'opening_bounds_violation')).toBe(true)
    })

    test('returns error for nonexistent wall', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const result = api.simulateWallChange('nonexistent', {
        wallId: 'nonexistent',
        thickness: 0.3,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('validateScene', () => {
    test('reports no issues for valid minimal scene', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const issues = api.validateScene()

      expect(issues.filter((i) => i.level === 'error')).toHaveLength(0)
    })

    test('reports orphan nodes', () => {
      const data = createMinimalScene()
      // Add a node with a parentId that doesn't exist
      data.nodes['orphan_node'] = {
        id: 'orphan_node',
        type: 'wall',
        parentId: 'nonexistent_parent',
        children: [],
        start: [0, 0],
        end: [1, 1],
      }

      const api = SceneApi.fromData(data)
      const issues = api.validateScene()

      expect(issues.some((i) => i.code === 'orphan_node')).toBe(true)
    })

    test('reports zero-length wall', () => {
      const data = createMinimalScene()
      data.nodes['wall_zero'] = {
        id: 'wall_zero',
        type: 'wall',
        parentId: 'level_test1',
        children: [],
        start: [3, 3] as [number, number],
        end: [3, 3] as [number, number], // zero length
      }

      const api = SceneApi.fromData(data)
      const issues = api.validateScene()

      expect(issues.some((i) => i.code === 'zero_length_wall')).toBe(true)
    })
  })

  describe('diffScene', () => {
    test('detects added nodes', () => {
      const from = createMinimalScene()
      const to = createMinimalScene()
      to.nodes['wall_new'] = {
        id: 'wall_new',
        type: 'wall',
        parentId: 'level_test1',
        children: [],
        start: [0, 0],
        end: [1, 1],
      }

      const api = SceneApi.fromData(to)
      const diff = api.diffScene(from)

      expect(diff.added).toContain('wall_new')
    })

    test('detects removed nodes', () => {
      const from = createMinimalScene()
      const to = createMinimalScene()
      delete to.nodes['wall_test2']

      const api = SceneApi.fromData(to)
      const diff = api.diffScene(from)

      expect(diff.removed).toContain('wall_test2')
    })

    test('detects modified nodes', () => {
      const from = createMinimalScene()
      const to = createMinimalScene()
      to.nodes['wall_test1'] = { ...to.nodes['wall_test1'], thickness: 0.4 }

      const api = SceneApi.fromData(to)
      const diff = api.diffScene(from)

      expect(diff.modified.some((m) => m.id === 'wall_test1')).toBe(true)
    })
  })

  describe('simulateWallPatch', () => {
    test('simulates a valid wall move', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const result = api.simulateWallPatch('wall_test1', {
        wallId: 'wall_test1',
        end: [6, 0],
      })

      // Wall_test1 goes from (0,0) to (5,0), moving end to (6,0) = 6m, still valid
      expect(result.success).toBe(true)
    })

    test('rejects too-short wall', () => {
      const api = SceneApi.fromData(createMinimalScene())
      const result = api.simulateWallPatch('wall_test1', {
        wallId: 'wall_test1',
        start: [0, 0],
        end: [0.05, 0], // 5cm wall = too short
      })

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('less than 0.1m'))).toBe(true)
    })
  })
})
