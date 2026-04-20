/**
 * Agent service — connects to Ollama (or compatible) and orchestrates tool calls.
 *
 * Flow:
 * 1. User sends a message
 * 2. We build a system prompt with scene context + tool definitions
 * 3. We send to Ollama with the conversation history
 * 4. If the model returns tool_calls, we execute them and send results back
 * 5. We repeat until the model gives a final response (or max turns)
 * 6. We update the chat UI with each step
 */

import { useScene } from '@pascal-app/core'
import type { ChatMessage, ChatMessageData } from '../../store/use-chat'
import { executeTool, TOOL_DEFINITIONS, type ToolResult } from './scene-tools'

// ── Config ─────────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  /** Ollama API base URL */
  baseUrl: string
  /** Model name */
  model: string
  /** Max tool-call rounds before forcing a final response */
  maxRounds: number
  /** Temperature */
  temperature: number
}

const DEFAULT_CONFIG: AgentConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'glm-5.1:cloud',
  maxRounds: 8,
  temperature: 0.3,
}

// ── System prompt ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const scene = useScene.getState()
  const buildings = Object.values(scene.nodes).filter((n) => n.type === 'building')
  const walls = Object.values(scene.nodes).filter((n) => n.type === 'wall')
  const zones = Object.values(scene.nodes).filter((n) => n.type === 'zone')
  const windows = Object.values(scene.nodes).filter((n) => n.type === 'window')
  const doors = Object.values(scene.nodes).filter((n) => n.type === 'door')

  const wallInfo = walls
    .map((w) => {
      const wd = w as any
      const dx = (wd.end?.[0] ?? 0) - (wd.start?.[0] ?? 0)
      const dz = (wd.end?.[1] ?? 0) - (wd.start?.[1] ?? 0)
      const length = Math.sqrt(dx * dx + dz * dz)
      return `- ${w.name || w.id}: (${wd.start?.[0]?.toFixed(1)},${wd.start?.[1]?.toFixed(1)}) → (${wd.end?.[0]?.toFixed(1)},${wd.end?.[1]?.toFixed(1)}) ${length.toFixed(1)}m`
    })
    .join('\n')

  const zoneInfo = zones.map((z) => `- ${(z as any).name || z.id}`).join('\n')

  const toolDefs = TOOL_DEFINITIONS.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([name, p]) => {
        const req = p.required ? ' (required)' : ''
        const def = p.default !== undefined ? `, default: ${p.default}` : ''
        const en = p.enum ? `, one of: ${p.enum.join('|')}` : ''
        return `    ${name}: ${p.type}${req}${def}${en} — ${p.description}`
      })
      .join('\n')
    return `\n## ${t.name}\n${t.description}\nParameters:\n${params}`
  }).join('\n')

  return `You are Pascal Agent, an AI assistant for the Pascal architectural editor. You create, modify, and inspect 3D architecture using the tools below.

## Current Scene
- Buildings: ${buildings.length}
- Walls: ${walls.length}${walls.length > 0 ? '\n' + wallInfo : ''}
- Zones: ${zones.length}${zones.length > 0 ? '\n' + zoneInfo : ''}
- Windows: ${windows.length}
- Doors: ${doors.length}

## Available Tools
${toolDefs}

## How to Respond

**Every action statement must be accompanied by the tool call in the same response.** Never say "I'll create..." and stop — output the \`\`\`json block immediately. If you need multiple tools, batch them all into a single \`\`\`json block.

Tool call format (one block, all calls inside):
\`\`\`json
{"tool_calls": [
  {"name": "TOOL_NAME", "args": {...}},
  {"name": "TOOL_NAME", "args": {...}}
]}
\`\`\`

After the tool results come back, give a **brief factual summary**: what was created, exact counts, e.g. "Created 4 walls, 1 door, 2 windows — scene now has 4 walls total." Call \`get_scene_info\` at the end of any multi-tool sequence to confirm the actual scene state.

Be ambitious: "create a house" → walls + door + windows + zone label. "Add a kitchen" inside an existing building → \`create_room\` (not a new building).

## Critical Rules

1. **Never plan without acting.** Phrases like "I'll set that up" or "Let me create..." must be followed by the JSON block in the same message. No exceptions.

2. **One \`\`\`json block per response.** The parser reads only the first \`\`\`json...\`\`\` it finds. Put all tool calls in it.

3. **Coordinates are XZ (floor plane).** \`start\`/\`end\` on walls are \`[x, z]\` 2-tuples. Y is up (height). Keep geometry within ±20m of origin (0,0) so it's visible in the default camera view.

4. **\`add_zone\` points must be a JSON string**, not an array:
   - CORRECT: \`"points": "[[0,0],[4,0],[4,3],[0,3]]"\`
   - WRONG:   \`"points": [[0,0],[4,0],[4,3],[0,3]]\`

5. **Don't create a new building if one already exists.** The tools call \`ensureBuilding()\` automatically — only add walls/rooms/zones to the existing building unless the scene is empty.

6. **Verify geometry with \`get_scene_info\`** after multi-step sequences. Report concrete numbers, not assumptions.

## Coordinate Reference
- Floor plane: X = left/right, Z = forward/back, Y = up
- Origin (0,0) = scene center; default camera frames ±15m
- Typical house: 6–12m wide × 4–10m deep, walls 2.4–3m high
- Door: 0.9m wide × 2.1m high; Window: 1.2m wide × 1.2m high at y=1.4m center

## Few-Shot Examples

**User:** Create a 10×8 cabin with a door and two windows.

**Assistant:**
I'll create a 10×8 cabin centered at the origin with a front door and windows on the north and east walls.
\`\`\`json
{"tool_calls": [
  {"name": "create_house", "args": {"name": "Cabin", "width": 10, "depth": 8, "wall_height": 2.8, "add_door": true, "add_windows": true}},
  {"name": "get_scene_info", "args": {}}
]}
\`\`\`

*(After tool results)*
Created "Cabin" (10m × 8m) with 4 walls, 1 front door, and 2 windows. Scene now has 1 building, 4 walls, 2 windows, 1 door, 1 zone.

---

**User:** Add a kitchen room 4×3m at position (1, 2), then label it with a blue zone.

**Assistant:**
Adding a 4×3m kitchen room starting at (1, 2) and labelling it with a zone.
\`\`\`json
{"tool_calls": [
  {"name": "create_room", "args": {"name": "Kitchen", "x": 1, "z": 2, "width": 4, "depth": 3}},
  {"name": "add_zone", "args": {"name": "Kitchen", "points": "[[1,2],[5,2],[5,5],[1,5]]", "color": "#3b82f6"}},
  {"name": "get_scene_info", "args": {}}
]}
\`\`\`

*(After tool results)*
Created Kitchen room (4m × 3m) at (1, 2) with 4 walls and a blue zone label. Note: \`add_zone\` points were passed as a JSON string — that's required.`
}

// ── Ollama API ──────────────────────────────────────────────────────────────────────

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

interface OllamaToolCall {
  name: string
  args: Record<string, unknown>
}

async function callOllama(messages: OllamaMessage[], config: AgentConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
      options: { temperature: config.temperature },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.message?.content ?? ''
}

// ── Parse tool calls from LLM response ──────────────────────────────────────────────

function parseToolCalls(text: string): OllamaToolCall[] {
  // Try to find a ```json block with tool_calls
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]!)
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return parsed.tool_calls.map((tc: any) => ({
          name: String(tc.name),
          args: tc.args ?? tc.arguments ?? tc.parameters ?? {},
        }))
      }
    } catch {
      /* fall through */
    }
  }

  // Try to find inline JSON with tool_calls
  const inlineMatch = text.match(/\{"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (inlineMatch) {
    try {
      const parsed = JSON.parse(inlineMatch[0])
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return parsed.tool_calls.map((tc: any) => ({
          name: String(tc.name),
          args: tc.args ?? tc.arguments ?? tc.parameters ?? {},
        }))
      }
    } catch {
      /* fall through */
    }
  }

  return []
}

// ── Public API ──────────────────────────────────────────────────────────────────────

export interface AgentResponse {
  content: string
  data?: ChatMessageData
  impacts?: ToolResult['impacts']
  toolCallsExecuted: number
}

export async function sendToAgent(
  userMessage: string,
  conversationHistory: ChatMessage[],
  config: AgentConfig = DEFAULT_CONFIG,
  onProgress?: (status: string) => void,
): Promise<AgentResponse> {
  const systemPrompt = buildSystemPrompt()

  // Build conversation messages
  const messages: OllamaMessage[] = [{ role: 'system', content: systemPrompt }]

  // Add conversation history (last 10 messages for context window)
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant' && !msg.isStreaming) {
      messages.push({ role: 'assistant', content: msg.content })
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  let allImpacts: ToolResult['impacts'] = []
  let totalToolCalls = 0
  let finalContent = ''

  for (let round = 0; round < config.maxRounds; round++) {
    onProgress?.(round === 0 ? 'Thinking...' : `Processing tool results (round ${round + 1})...`)

    // Call Ollama
    let response: string
    try {
      response = await callOllama(messages, config)
    } catch (err) {
      // If Ollama is unavailable, fall back to a helpful error message
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (
        errorMsg.includes('fetch') ||
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('Ollama')
      ) {
        return {
          content: `⚠️ Could not connect to Ollama at ${config.baseUrl}.\n\nMake sure Ollama is running:\n\`\`\`bash\nollama serve\n\`\`\`\n\nAnd pull a model:\n\`\`\`bash\nollama pull ${config.model}\n\`\`\`\n\nIn the meantime, I'll try to handle your request with local pattern matching.`,
          toolCallsExecuted: 0,
        }
      }
      throw err
    }

    // Try to parse tool calls
    const toolCalls = parseToolCalls(response)

    if (toolCalls.length === 0) {
      // Check if the model responded with planning intent but no tools yet (first round only)
      // e.g. "I'll create..." / "Let me..." / "I will..."
      const isPlanningResponse =
        round === 0 &&
        totalToolCalls === 0 &&
        /\b(i'?ll|let me|i will|i'm going to|i am going to|creating|i can|sure|of course|absolutely)\b/i.test(
          response,
        )

      if (isPlanningResponse) {
        // Push the model to actually execute with tool calls
        messages.push({ role: 'assistant', content: response })
        messages.push({
          role: 'user',
          content:
            'Please now execute the task using the available tools. Output a JSON block with tool_calls to perform the actions.',
        })
        continue
      }

      // No tool calls and not a planning response — this is the final response
      finalContent = response
      break
    }

    // Execute tool calls
    const toolResults: string[] = []
    for (const tc of toolCalls) {
      totalToolCalls++
      const result = executeTool(tc.name, tc.args)
      toolResults.push(
        `Tool: ${tc.name}\nResult: ${result.success ? '✅' : '❌'} ${result.message}`,
      )
      if (result.impacts) {
        allImpacts = [...allImpacts, ...result.impacts]
      }
    }

    // Add assistant response and tool results to conversation
    messages.push({ role: 'assistant', content: response })
    messages.push({ role: 'tool', content: toolResults.join('\n\n') })

    // If this is the last round, summarize
    if (round === config.maxRounds - 1) {
      finalContent = response + '\n\n*(Max tool rounds reached)*'
    }
  }

  // If we went through all rounds with only tool calls, ask for a final summary
  if (!finalContent) {
    onProgress?.('Generating summary...')
    messages.push({ role: 'user', content: 'Please provide a brief summary of what you did.' })
    finalContent = await callOllama(messages, config)
  }

  return {
    content: finalContent,
    impacts: allImpacts.length > 0 ? allImpacts : undefined,
    toolCallsExecuted: totalToolCalls,
  }
}

// ── Local fallback (no LLM needed) ──────────────────────────────────────────────────

const LOCAL_PATTERNS: Array<{
  pattern: RegExp
  tool: string
  args: (match: RegExpMatchArray) => Record<string, unknown>
}> = [
  {
    pattern: /create\s+(?:a\s+)?(?:house|home|building|residence)/i,
    tool: 'create_house',
    args: () => ({}),
  },
  {
    pattern: /create\s+(?:a\s+)?(\d+)\s*(?:by|x)\s*(\d+)\s*(?:house|home|building|residence)/i,
    tool: 'create_house',
    args: (m) => ({ width: Number(m[1]), depth: Number(m[2]) }),
  },
  {
    pattern:
      /(?:add|create|make)\s+(?:a\s+)?room\s+(?:called\s+)?["']?(\w+)["']?\s*(?:which\s+is\s+)?(\d+(?:\.\d+)?)\s*(?:m\s*)?[x×by]\s*(\d+(?:\.\d+)?)\s*m?/i,
    tool: 'create_room',
    args: (m) => ({ name: m[1], width: Number(m[2]), depth: Number(m[3]) }),
  },
  {
    pattern:
      /(?:add|create|make)\s+(?:a\s+)?room\s+(\d+(?:\.\d+)?)\s*(?:m\s*)?[x×by]\s*(\d+(?:\.\d+)?)\s*m?/i,
    tool: 'create_room',
    args: (m) => ({ name: 'Room', width: Number(m[1]), depth: Number(m[2]) }),
  },
  {
    pattern:
      /(?:add|create|make)\s+(?:a\s+)?wall\s+(?:from\s+)?\(?(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)?\s*(?:to|-+>)\s*\(?(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)?/i,
    tool: 'add_wall',
    args: (m) => ({
      start_x: Number(m[1]),
      start_z: Number(m[2]),
      end_x: Number(m[3]),
      end_z: Number(m[4]),
    }),
  },
  {
    pattern:
      /(?:add|create|make)\s+(?:a\s+)?(?:window|windows?)\s+(?:on|to|in)\s+(?:the\s+)?(\w+)\s*(?:wall)?/i,
    tool: 'add_window',
    args: (m) => ({ wall_ref: m[1] }),
  },
  {
    pattern: /(?:add|create|make)\s+(?:a\s+)?door\s+(?:on|to|in)\s+(?:the\s+)?(\w+)\s*(?:wall)?/i,
    tool: 'add_door',
    args: (m) => ({ wall_ref: m[1] }),
  },
  {
    pattern: /(?:move|shift|extend|push)\s+(?:the\s+)?(\w+)\s+(?:wall\s+)?(.+)/i,
    tool: 'move_wall',
    args: (m) => ({ wall_ref: m[1], endpoint: 'end', new_x: 0, new_z: 0 }), // Simplified
  },
  {
    pattern: /(?:inspect|show|describe|tell me about)\s+(?:the\s+)?(\w+)\s*(?:wall)?/i,
    tool: 'inspect_wall',
    args: (m) => ({ wall_ref: m[1] }),
  },
  {
    pattern: /(?:scene|what|summary|info|overview|current)/i,
    tool: 'get_scene_info',
    args: () => ({}),
  },
  {
    pattern: /(?:delete|remove)\s+(?:the\s+)?(.+)/i,
    tool: 'delete_node',
    args: (m) => ({ node_ref: m[1] }),
  },
]

export function localFallback(userMessage: string): ToolResult | null {
  for (const { pattern, tool, args } of LOCAL_PATTERNS) {
    const match = userMessage.match(pattern)
    if (match) {
      return executeTool(tool, args(match))
    }
  }
  return null
}

export { DEFAULT_CONFIG }
