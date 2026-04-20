/**
 * Scene tools — real operations that mutate the Zustand scene store.
 *
 * These are the "hands" of the agent. Each tool:
 * 1. Validates its inputs
 * 2. Creates the proper Zod-validated node(s)
 * 3. Inserts them into the scene graph via `useScene`
 * 4. Returns a human-readable description of what happened
 *
 * The LLM decides WHICH tools to call and with WHAT parameters.
 * The tools handle the "how" — they know the schema, defaults, and parent/child relationships.
 */

import {
  BuildingNode,
  DoorNode,
  LevelNode,
  SiteNode,
  WallNode,
  WindowNode,
  ZoneNode,
  type AnyNode,
  type AnyNodeId,
  generateId,
  useScene,
} from '@pascal-app/core'

// ── Helpers ────────────────────────────────────────────────────────────────────────

function getScene() {
  return useScene.getState()
}

/** Look up a node by ID or name (case-insensitive) */
function findNodeByNameOrId(ref: string): AnyNode | undefined {
  const { nodes } = getScene()
  const lower = ref.toLowerCase().trim()
  // Try exact ID match first
  const exactMatch = nodes[ref as AnyNodeId]
  if (exactMatch) return exactMatch
  // Try name match
  for (const node of Object.values(nodes)) {
    if (node.name && node.name.toLowerCase() === lower) return node
    if (node.name && node.name.toLowerCase().includes(lower)) return node
  }
  return undefined
}

function findLevelInBuilding(buildingId: string, levelNum = 0): string | undefined {
  const { nodes } = getScene()
  const building = nodes[buildingId as AnyNodeId]
  if (!building || building.type !== 'building') return undefined
  for (const cid of (building as { children: string[] }).children) {
    const child = nodes[cid as AnyNodeId]
    if (child?.type === 'level' && (child as LevelNode).level === levelNum) return child.id
  }
  return undefined
}

function findFirstBuilding(): string | undefined {
  const { nodes, rootNodeIds } = getScene()
  for (const rid of rootNodeIds) {
    const node = nodes[rid]
    if (node?.type === 'site') {
      // site.children may contain full node objects (from loadScene) or string IDs
      for (const child of (node as any).children ?? []) {
        const id = typeof child === 'string' ? child : child?.id
        if (id && nodes[id as AnyNodeId]?.type === 'building') return id
        // If the child object itself is a building (embedded object not in nodes dict)
        if (child?.type === 'building') return child.id
      }
    }
    if (node?.type === 'building') return String(rid)
  }
  return undefined
}

function ensureBuilding(): string {
  const { nodes, rootNodeIds, createNode } = getScene()
  const existingId = findFirstBuilding()
  if (existingId) return existingId

  let siteId: string | undefined
  for (const rid of rootNodeIds) {
    if (nodes[rid]?.type === 'site') {
      siteId = rid
      break
    }
  }

  if (!siteId) {
    const site = SiteNode.parse({
      polygon: {
        type: 'polygon' as const,
        points: [
          [-15, -15],
          [15, -15],
          [15, 15],
          [-15, 15],
        ],
      },
    })
    createNode(site)
    siteId = site.id
  }

  const level = LevelNode.parse({ level: 0 })
  const building = BuildingNode.parse({ children: [level.id] })

  createNode(building, siteId as AnyNodeId)
  createNode(level, building.id as AnyNodeId)

  return building.id
}

// ── Tool definitions for the LLM ──────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<
    string,
    { type: string; description: string; required?: boolean; enum?: string[]; default?: unknown }
  >
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_house',
    description:
      'Create a house with walls forming a rectangular floor plan. Optionally add windows and doors.',
    parameters: {
      name: { type: 'string', description: 'Name for the house/building', default: 'House' },
      width: { type: 'number', description: 'Width of the house in meters (x-axis)', default: 8 },
      depth: { type: 'number', description: 'Depth of the house in meters (z-axis)', default: 6 },
      wall_thickness: { type: 'number', description: 'Wall thickness in meters', default: 0.2 },
      wall_height: { type: 'number', description: 'Wall height in meters', default: 2.8 },
      add_door: { type: 'boolean', description: 'Whether to add a front door', default: true },
      add_windows: {
        type: 'boolean',
        description: 'Whether to add windows to exterior walls',
        default: true,
      },
    },
  },
  {
    name: 'create_room',
    description:
      'Create a room by adding walls inside the current building. Good for subdividing space.',
    parameters: {
      name: { type: 'string', description: 'Name for the room/zone', default: 'Room' },
      x: { type: 'number', description: 'X position of room origin corner', default: 0 },
      z: { type: 'number', description: 'Z position of room origin corner', default: 0 },
      width: { type: 'number', description: 'Room width in meters', required: true },
      depth: { type: 'number', description: 'Room depth in meters', required: true },
      wall_thickness: { type: 'number', description: 'Wall thickness in meters', default: 0.15 },
      wall_height: { type: 'number', description: 'Wall height in meters', default: 2.8 },
    },
  },
  {
    name: 'add_wall',
    description: 'Add a single wall to the current building level.',
    parameters: {
      name: { type: 'string', description: 'Name for the wall', default: '' },
      start_x: { type: 'number', description: 'Start X coordinate', required: true },
      start_z: { type: 'number', description: 'Start Z coordinate', required: true },
      end_x: { type: 'number', description: 'End X coordinate', required: true },
      end_z: { type: 'number', description: 'End Z coordinate', required: true },
      thickness: { type: 'number', description: 'Wall thickness in meters', default: 0.2 },
      height: { type: 'number', description: 'Wall height in meters', default: 2.8 },
    },
  },
  {
    name: 'add_window',
    description: 'Add a window to an existing wall.',
    parameters: {
      wall_ref: {
        type: 'string',
        description: 'Wall ID or name to add the window to',
        required: true,
      },
      position_x: { type: 'number', description: 'X position along the wall (center)', default: 0 },
      position_y: {
        type: 'number',
        description: 'Y position (height) of window center',
        default: 1.4,
      },
      width: { type: 'number', description: 'Window width in meters', default: 1.2 },
      height: { type: 'number', description: 'Window height in meters', default: 1.2 },
    },
  },
  {
    name: 'add_door',
    description: 'Add a door to an existing wall.',
    parameters: {
      wall_ref: {
        type: 'string',
        description: 'Wall ID or name to add the door to',
        required: true,
      },
      position_x: { type: 'number', description: 'X position along the wall (center)', default: 0 },
      width: { type: 'number', description: 'Door width in meters', default: 0.9 },
      height: { type: 'number', description: 'Door height in meters', default: 2.1 },
    },
  },
  {
    name: 'add_zone',
    description: 'Add a named zone (room label) to the current level.',
    parameters: {
      name: {
        type: 'string',
        description: 'Zone name (e.g. "Kitchen", "Living Room")',
        required: true,
      },
      points: {
        type: 'string',
        description: 'JSON array of [x, z] polygon points, e.g. [[0,0],[4,0],[4,3],[0,3]]',
        required: true,
      },
      color: { type: 'string', description: 'Hex color for the zone', default: '#3b82f6' },
    },
  },
  {
    name: 'move_wall',
    description: 'Move a wall endpoint to a new position.',
    parameters: {
      wall_ref: { type: 'string', description: 'Wall ID or name', required: true },
      endpoint: {
        type: 'string',
        description: 'Which endpoint to move: "start" or "end"',
        enum: ['start', 'end'],
        required: true,
      },
      new_x: { type: 'number', description: 'New X coordinate', required: true },
      new_z: { type: 'number', description: 'New Z coordinate', required: true },
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node (wall, window, door, zone, etc.) from the scene.',
    parameters: {
      node_ref: { type: 'string', description: 'Node ID or name to delete', required: true },
    },
  },
  {
    name: 'get_scene_info',
    description: 'Get a summary of the current scene — buildings, levels, walls, zones, etc.',
    parameters: {},
  },
  {
    name: 'inspect_wall',
    description: 'Get detailed info about a wall (length, angle, openings, connected walls).',
    parameters: {
      wall_ref: { type: 'string', description: 'Wall ID or name', required: true },
    },
  },
]

// ── Tool executor ──────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
  impacts?: Array<{
    category: string
    description: string
    severity: 'info' | 'warning' | 'error'
    affectedIds: string[]
  }>
}

export function executeTool(toolName: string, args: Record<string, unknown>): ToolResult {
  switch (toolName) {
    case 'create_house':
      return createHouse(args)
    case 'create_room':
      return createRoom(args)
    case 'add_wall':
      return addWall(args)
    case 'add_window':
      return addWindow(args)
    case 'add_door':
      return addDoor(args)
    case 'add_zone':
      return addZone(args)
    case 'move_wall':
      return moveWall(args)
    case 'delete_node':
      return deleteNode(args)
    case 'get_scene_info':
      return getSceneInfo()
    case 'inspect_wall':
      return inspectWall(args)
    default:
      return { success: false, message: `Unknown tool: ${toolName}` }
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────────

function createHouse(args: Record<string, unknown>): ToolResult {
  const name = String(args.name ?? 'House')
  const width = Number(args.width ?? 8)
  const depth = Number(args.depth ?? 6)
  const wallThickness = Number(args.wall_thickness ?? 0.2)
  const wallHeight = Number(args.wall_height ?? 2.8)
  const addDoor = args.add_door !== false
  const addWindows = args.add_windows !== false

  const { createNode, createNodes } = getScene()
  const buildingId = ensureBuilding()
  const { nodes } = getScene()
  const building = nodes[buildingId as AnyNodeId]
  if (!building || building.type !== 'building') {
    return { success: false, message: 'No building found in scene' }
  }

  const levelId = (building as BuildingNode).children[0] || findLevelInBuilding(buildingId)
  if (!levelId) {
    return { success: false, message: 'No level found in building' }
  }

  // Create 4 walls forming a rectangle
  const hw = width / 2
  const hd = depth / 2
  const wallIds: string[] = []
  const ops: { node: AnyNode; parentId: AnyNodeId }[] = []

  // North wall
  const northWall = WallNode.parse({
    name: `${name} North`,
    parentId: levelId,
    start: [-hw, -hd] as [number, number],
    end: [hw, -hd] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'exterior',
  })
  wallIds.push(northWall.id)
  ops.push({ node: northWall, parentId: levelId as AnyNodeId })

  // East wall
  const eastWall = WallNode.parse({
    name: `${name} East`,
    parentId: levelId,
    start: [hw, -hd] as [number, number],
    end: [hw, hd] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'exterior',
  })
  wallIds.push(eastWall.id)
  ops.push({ node: eastWall, parentId: levelId as AnyNodeId })

  // South wall
  const southWall = WallNode.parse({
    name: `${name} South`,
    parentId: levelId,
    start: [hw, hd] as [number, number],
    end: [-hw, hd] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'exterior',
  })
  wallIds.push(southWall.id)
  ops.push({ node: southWall, parentId: levelId as AnyNodeId })

  // West wall
  const westWall = WallNode.parse({
    name: `${name} West`,
    parentId: levelId,
    start: [-hw, hd] as [number, number],
    end: [-hw, -hd] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'exterior',
  })
  wallIds.push(westWall.id)
  ops.push({ node: westWall, parentId: levelId as AnyNodeId })

  // Add door on south wall
  if (addDoor) {
    const door = DoorNode.parse({
      name: `${name} Front Door`,
      parentId: southWall.id,
      position: [0, 1.05, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      side: 'front',
      wallId: southWall.id,
      width: 0.9,
      height: 2.1,
    })
    ops.push({ node: door, parentId: southWall.id as AnyNodeId })
    // Add door to south wall children
    southWall.children.push(door.id as never)
  }

  // Add windows on north and east walls
  if (addWindows) {
    if (width >= 3) {
      const windowNorth = WindowNode.parse({
        name: `${name} North Window`,
        parentId: northWall.id,
        position: [0, 1.4, 0] as [number, number, number],
        side: 'front',
        wallId: northWall.id,
        width: 1.2,
        height: 1.2,
      })
      ops.push({ node: windowNorth, parentId: northWall.id as AnyNodeId })
      northWall.children.push(windowNorth.id as never)
    }
    if (depth >= 3) {
      const windowEast = WindowNode.parse({
        name: `${name} East Window`,
        parentId: eastWall.id,
        position: [0, 1.4, 0] as [number, number, number],
        side: 'front',
        wallId: eastWall.id,
        width: 1.2,
        height: 1.2,
      })
      ops.push({ node: windowEast, parentId: eastWall.id as AnyNodeId })
      eastWall.children.push(windowEast.id as never)
    }
  }

  // Add zone
  const zone = ZoneNode.parse({
    parentId: levelId,
    name,
    polygon: [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ],
    color: '#3b82f6',
  })
  ops.push({ node: zone, parentId: levelId as AnyNodeId })

  createNodes(ops)

  return {
    success: true,
    message: `Created ${name} (${width}m × ${depth}m) with ${wallIds.length} walls${addDoor ? ', 1 door' : ''}${addWindows ? ', windows' : ''}`,
    data: { buildingId, levelId, wallIds, width, depth, name },
    impacts: [],
  }
}

function createRoom(args: Record<string, unknown>): ToolResult {
  const name = String(args.name ?? 'Room')
  const x = Number(args.x ?? 0)
  const z = Number(args.z ?? 0)
  const width = Number(args.width)
  const depth = Number(args.depth)
  const wallThickness = Number(args.wall_thickness ?? 0.15)
  const wallHeight = Number(args.wall_height ?? 2.8)

  if (!width || !depth) {
    return { success: false, message: 'Room width and depth are required' }
  }

  const buildingId = ensureBuilding()
  const levelId = findLevelInBuilding(buildingId)
  if (!levelId) return { success: false, message: 'No level found in building' }

  const wallIds: string[] = []
  const ops: { node: AnyNode; parentId: AnyNodeId }[] = []

  // 4 walls
  const northWall = WallNode.parse({
    name: `${name} N`,
    parentId: levelId,
    start: [x, z] as [number, number],
    end: [x + width, z] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'interior',
  })
  wallIds.push(northWall.id)
  ops.push({ node: northWall, parentId: levelId as AnyNodeId })

  const eastWall = WallNode.parse({
    name: `${name} E`,
    parentId: levelId,
    start: [x + width, z] as [number, number],
    end: [x + width, z + depth] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'interior',
  })
  wallIds.push(eastWall.id)
  ops.push({ node: eastWall, parentId: levelId as AnyNodeId })

  const southWall = WallNode.parse({
    name: `${name} S`,
    parentId: levelId,
    start: [x + width, z + depth] as [number, number],
    end: [x, z + depth] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'interior',
  })
  wallIds.push(southWall.id)
  ops.push({ node: southWall, parentId: levelId as AnyNodeId })

  const westWall = WallNode.parse({
    name: `${name} W`,
    parentId: levelId,
    start: [x, z + depth] as [number, number],
    end: [x, z] as [number, number],
    thickness: wallThickness,
    height: wallHeight,
    frontSide: 'interior',
    backSide: 'interior',
  })
  wallIds.push(westWall.id)
  ops.push({ node: westWall, parentId: levelId as AnyNodeId })

  // Zone
  const zone = ZoneNode.parse({
    parentId: levelId,
    name,
    polygon: [
      [x, z],
      [x + width, z],
      [x + width, z + depth],
      [x, z + depth],
    ],
    color: '#10b981',
  })
  ops.push({ node: zone, parentId: levelId as AnyNodeId })

  getScene().createNodes(ops)

  return {
    success: true,
    message: `Created room "${name}" at (${x}, ${z}) — ${width}m × ${depth}m`,
    data: { wallIds, name, x, z, width, depth },
  }
}

function addWall(args: Record<string, unknown>): ToolResult {
  const name = String(args.name ?? '')
  const startX = Number(args.start_x)
  const startZ = Number(args.start_z)
  const endX = Number(args.end_x)
  const endZ = Number(args.end_z)
  const thickness = Number(args.thickness ?? 0.2)
  const height = Number(args.height ?? 2.8)

  if ([startX, startZ, endX, endZ].some(Number.isNaN)) {
    return { success: false, message: 'Start and end coordinates are required' }
  }

  const buildingId = ensureBuilding()
  const levelId = findLevelInBuilding(buildingId)
  if (!levelId) return { success: false, message: 'No level found' }

  const wall = WallNode.parse({
    ...(name ? { name } : {}),
    parentId: levelId,
    start: [startX, startZ] as [number, number],
    end: [endX, endZ] as [number, number],
    thickness,
    height,
    frontSide: 'unknown',
    backSide: 'unknown',
  })

  getScene().createNode(wall, levelId as AnyNodeId)

  const length = Math.sqrt((endX - startX) ** 2 + (endZ - startZ) ** 2)
  return {
    success: true,
    message: `Added wall "${name || wall.id}" from (${startX.toFixed(2)}, ${startZ.toFixed(2)}) to (${endX.toFixed(2)}, ${endZ.toFixed(2)}) — ${length.toFixed(2)}m`,
    data: { wallId: wall.id, startX, startZ, endX, endZ, length },
  }
}

function addWindow(args: Record<string, unknown>): ToolResult {
  const wallRef = String(args.wall_ref)
  const posX = Number(args.position_x ?? 0)
  const posY = Number(args.position_y ?? 1.4)
  const w = Number(args.width ?? 1.2)
  const h = Number(args.height ?? 1.2)

  const wall = findNodeByNameOrId(wallRef)
  if (!wall || wall.type !== 'wall') {
    return { success: false, message: `Wall not found: ${wallRef}` }
  }

  const windowNode = WindowNode.parse({
    name: `Window on ${wall.name ?? wall.id}`,
    parentId: wall.id,
    position: [posX, posY, 0] as [number, number, number],
    side: 'front',
    wallId: wall.id,
    width: w,
    height: h,
  })

  getScene().createNode(windowNode, wall.id as AnyNodeId)

  return {
    success: true,
    message: `Added ${w}m × ${h}m window on wall "${wall.name ?? wall.id}" at position (${posX.toFixed(2)}, ${posY.toFixed(2)})`,
  }
}

function addDoor(args: Record<string, unknown>): ToolResult {
  const wallRef = String(args.wall_ref)
  const posX = Number(args.position_x ?? 0)
  const w = Number(args.width ?? 0.9)
  const h = Number(args.height ?? 2.1)

  const wall = findNodeByNameOrId(wallRef)
  if (!wall || wall.type !== 'wall') {
    return { success: false, message: `Wall not found: ${wallRef}` }
  }

  const door = DoorNode.parse({
    name: `Door on ${wall.name ?? wall.id}`,
    parentId: wall.id,
    position: [posX, h / 2, 0] as [number, number, number],
    side: 'front',
    wallId: wall.id,
    width: w,
    height: h,
  })

  getScene().createNode(door, wall.id as AnyNodeId)

  return {
    success: true,
    message: `Added ${w}m × ${h}m door on wall "${wall.name ?? wall.id}"`,
  }
}

function addZone(args: Record<string, unknown>): ToolResult {
  const name = String(args.name)
  const pointsJson = String(args.points)
  const color = String(args.color ?? '#3b82f6')

  let points: [number, number][]
  try {
    points = JSON.parse(pointsJson)
  } catch {
    return { success: false, message: `Invalid points JSON: ${pointsJson}` }
  }

  const buildingId = ensureBuilding()
  const levelId = findLevelInBuilding(buildingId)
  if (!levelId) return { success: false, message: 'No level found' }

  const zone = ZoneNode.parse({
    parentId: levelId,
    name,
    polygon: points,
    color,
  })

  getScene().createNode(zone, levelId as AnyNodeId)

  return {
    success: true,
    message: `Created zone "${name}" with ${points.length} points`,
  }
}

function moveWall(args: Record<string, unknown>): ToolResult {
  const wallRef = String(args.wall_ref)
  const endpoint = String(args.endpoint)
  const newX = Number(args.new_x)
  const newZ = Number(args.new_z)

  const wall = findNodeByNameOrId(wallRef)
  if (!wall || wall.type !== 'wall') {
    return { success: false, message: `Wall not found: ${wallRef}` }
  }

  const wallData = wall as WallNode
  const oldStart = wallData.start
  const oldEnd = wallData.end

  if (endpoint === 'start') {
    getScene().updateNode(wall.id, { start: [newX, newZ] })
  } else if (endpoint === 'end') {
    getScene().updateNode(wall.id, { end: [newX, newZ] })
  } else {
    return { success: false, message: `Invalid endpoint: ${endpoint}. Use "start" or "end".` }
  }

  const newLength =
    endpoint === 'start'
      ? Math.sqrt((oldEnd[0] - newX) ** 2 + (oldEnd[1] - newZ) ** 2)
      : Math.sqrt((newX - oldStart[0]) ** 2 + (newZ - oldStart[1]) ** 2)

  return {
    success: true,
    message: `Moved ${endpoint} of wall "${wall.name ?? wall.id}" to (${newX.toFixed(2)}, ${newZ.toFixed(2)}). New length: ${newLength.toFixed(2)}m`,
    data: { wallId: wall.id, endpoint, newX, newZ, newLength },
  }
}

function deleteNode(args: Record<string, unknown>): ToolResult {
  const nodeRef = String(args.node_ref)
  const node = findNodeByNameOrId(nodeRef)
  if (!node) {
    return { success: false, message: `Node not found: ${nodeRef}` }
  }

  getScene().deleteNode(node.id)
  return {
    success: true,
    message: `Deleted ${node.type} "${node.name ?? node.id}"`,
  }
}

function getSceneInfo(): ToolResult {
  const { nodes } = getScene()

  const allNodes = Object.values(nodes)
  const buildings = allNodes.filter((n) => n.type === 'building')
  const levels = allNodes.filter((n) => n.type === 'level')
  const walls = allNodes.filter((n) => n.type === 'wall')
  const zones = allNodes.filter((n) => n.type === 'zone')
  const windows = allNodes.filter((n) => n.type === 'window')
  const doors = allNodes.filter((n) => n.type === 'door')

  const wallSummary = walls
    .map((w) => {
      const wd = w as WallNode
      const dx = wd.end[0] - wd.start[0]
      const dz = wd.end[1] - wd.start[1]
      const length = Math.sqrt(dx * dx + dz * dz)
      return `  - ${w.name ?? w.id}: (${wd.start[0].toFixed(1)}, ${wd.start[1].toFixed(1)}) → (${wd.end[0].toFixed(1)}, ${wd.end[1].toFixed(1)}) — ${length.toFixed(2)}m`
    })
    .join('\n')

  const zoneSummary = zones
    .map((z) => {
      const zd = z as ZoneNode
      return `  - ${zd.name ?? z.id} (polygon: ${zd.polygon.length} points)`
    })
    .join('\n')

  return {
    success: true,
    message: `Scene has ${buildings.length} building(s), ${levels.length} level(s), ${walls.length} wall(s), ${zones.length} zone(s), ${windows.length} window(s), ${doors.length} door(s)\n\nWalls:\n${wallSummary || '  (none)'}\n\nZones:\n${zoneSummary || '  (none)'}`,
    data: {
      buildingCount: buildings.length,
      levelCount: levels.length,
      wallCount: walls.length,
      zoneCount: zones.length,
      windowCount: windows.length,
      doorCount: doors.length,
    },
  }
}

function inspectWall(args: Record<string, unknown>): ToolResult {
  const wallRef = String(args.wall_ref)
  const wall = findNodeByNameOrId(wallRef)
  if (!wall || wall.type !== 'wall') {
    return { success: false, message: `Wall not found: ${wallRef}` }
  }

  const wd = wall as WallNode
  const dx = wd.end[0] - wd.start[0]
  const dz = wd.end[1] - wd.start[1]
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = (Math.atan2(dz, dx) * 180) / Math.PI

  const { nodes } = getScene()
  const openings = wd.children.map((cid) => {
    const child = nodes[cid as AnyNodeId]
    return child ? `${child.type} "${child.name ?? child.id}"` : cid
  })

  return {
    success: true,
    message: `Wall "${wall.name ?? wall.id}"\n  Start: (${wd.start[0].toFixed(2)}, ${wd.start[1].toFixed(2)})\n  End: (${wd.end[0].toFixed(2)}, ${wd.end[1].toFixed(2)})\n  Length: ${length.toFixed(2)}m\n  Angle: ${angle.toFixed(1)}°\n  Thickness: ${(wd.thickness ?? 0.2).toFixed(2)}m\n  Height: ${(wd.height ?? 2.8).toFixed(2)}m\n  Front: ${wd.frontSide ?? 'unknown'}\n  Back: ${wd.backSide ?? 'unknown'}\n  Openings: ${openings.length > 0 ? openings.join(', ') : 'none'}`,
    data: {
      wallId: wall.id,
      wallName: wall.name,
      start: wd.start,
      end: wd.end,
      length,
      angle,
      thickness: wd.thickness ?? 0.2,
      height: wd.height ?? 2.8,
      openings: wd.children,
    },
  }
}