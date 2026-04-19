/**
 * Execution log — machine-readable log of task execution.
 */

export interface LogEntry {
  timestamp: string
  step: string
  level: 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, unknown>
}

export class ExecutionLog {
  private entries: LogEntry[] = []

  info(step: string, message: string, data?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      step,
      level: 'info',
      message,
      data,
    })
  }

  warn(step: string, message: string, data?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      step,
      level: 'warn',
      message,
      data,
    })
  }

  error(step: string, message: string, data?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      step,
      level: 'error',
      message,
      data,
    })
  }

  getEntries(): LogEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries = []
  }

  toJSON(): LogEntry[] {
    return this.entries
  }
}
