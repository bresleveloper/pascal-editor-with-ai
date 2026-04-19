/**
 * Tool registry — schema-validated tools that the planner/executor can call.
 */

import type { z } from 'zod'

export interface ToolDefinition {
  name: string
  description: string
  parameters: z.ZodType<unknown>
  execute: (args: unknown) => Promise<ToolResult>
  supportsDryRun?: boolean
  dryRun?: (args: unknown) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  warnings?: string[]
  impactedIds?: string[]
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
    return this
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  list(): string[] {
    return [...this.tools.keys()]
  }

  /**
   * Execute a tool by name with validated parameters.
   */
  async execute(name: string, args: unknown, dryRun = false): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found. Available: ${this.list().join(', ')}`,
      }
    }

    // Validate parameters
    const parsed = tool.parameters.safeParse(args)
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid arguments for tool "${name}": ${parsed.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    // Execute or dry-run
    if (dryRun && tool.dryRun) {
      return tool.dryRun(parsed.data)
    }
    return tool.execute(parsed.data)
  }

  /**
   * Check if a tool name is valid.
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }
}
