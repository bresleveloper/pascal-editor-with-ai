/**
 * Task runner — orchestrates step execution with retry and logging.
 */

import type { Plan, PlanStep } from '../planner/planner'
import { BlockerPolicy, type FailureClassification } from './blocker-policy'
import type { LogEntry } from './execution-log'
import { ExecutionLog } from './execution-log'
import { type RetryConfig, RetryPolicy } from './retry-policy'

export interface TaskRunnerConfig {
  retry?: RetryConfig
  maxSteps?: number
  stopOnBlocker?: boolean
}

export interface TaskResult {
  success: boolean
  steps: Array<{
    step: PlanStep
    success: boolean
    attempts: number
    error?: string
    classification?: FailureClassification
  }>
  log: LogEntry[]
}

export class TaskRunner {
  private retryPolicy: RetryPolicy
  private blockerPolicy: BlockerPolicy
  private executionLog: ExecutionLog
  private maxSteps: number
  private stopOnBlocker: boolean

  constructor(config: TaskRunnerConfig = {}) {
    this.retryPolicy = new RetryPolicy(config.retry)
    this.blockerPolicy = new BlockerPolicy()
    this.executionLog = new ExecutionLog()
    this.maxSteps = config.maxSteps ?? 50
    this.stopOnBlocker = config.stopOnBlocker ?? true
  }

  /**
   * Execute a plan step by step, with retries and blocker detection.
   */
  async run(plan: Plan, executeStep: (step: PlanStep) => Promise<unknown>): Promise<TaskResult> {
    const results: TaskResult['steps'] = []

    for (let i = 0; i < Math.min(plan.steps.length, this.maxSteps); i++) {
      const step = plan.steps[i]
      let success = false
      let attempts = 0
      let lastError: string | undefined
      let classification: FailureClassification | undefined

      // Retry loop
      for (let attempt = 0; attempt < this.retryPolicy.maxRetries; attempt++) {
        attempts = attempt + 1
        this.executionLog.info('task-runner', `Executing step "${step.name}" (attempt ${attempts})`)

        try {
          await executeStep(step)
          success = true
          this.executionLog.info('task-runner', `Step "${step.name}" succeeded`)
          break
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
          classification = this.blockerPolicy.classify(lastError)
          this.executionLog.warn(
            'task-runner',
            `Step "${step.name}" failed: ${lastError} (${classification})`,
          )

          if (classification === 'blocker') {
            this.executionLog.error('task-runner', `Blocker detected: ${lastError}`)
            break
          }

          if (!this.retryPolicy.shouldRetry(attempt, lastError)) {
            break
          }

          // Wait before retry
          const delay = this.retryPolicy.getDelay(attempt)
          this.executionLog.info('task-runner', `Retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      results.push({
        step,
        success,
        attempts,
        error: success ? undefined : lastError,
        classification,
      })

      // If blocker and stopOnBlocker, abort
      if (!success && classification === 'blocker' && this.stopOnBlocker) {
        this.executionLog.error('task-runner', 'Stopping due to blocker')
        break
      }

      // If step failed non-blocker after all retries, still continue (auto-repair approach)
      if (!success && classification !== 'blocker') {
        this.executionLog.info(
          'task-runner',
          `Step "${step.name}" failed but continuing (non-blocker)`,
        )
      }
    }

    const allSuccess = results.every((r) => r.success)
    return {
      success: allSuccess,
      steps: results,
      log: this.executionLog.getEntries(),
    }
  }

  getLog(): LogEntry[] {
    return this.executionLog.getEntries()
  }
}
