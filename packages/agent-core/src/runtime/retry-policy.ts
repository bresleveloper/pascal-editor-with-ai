/**
 * Retry policy for transient failures.
 */

export interface RetryConfig {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

export class RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number

  constructor(config: RetryConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3
    this.baseDelayMs = config.baseDelayMs ?? 1000
    this.maxDelayMs = config.maxDelayMs ?? 30000
    this.backoffMultiplier = config.backoffMultiplier ?? 2
  }

  shouldRetry(attempt: number, _error: string): boolean {
    return attempt < this.maxRetries
  }

  getDelay(attempt: number): number {
    const delay = this.baseDelayMs * this.backoffMultiplier ** attempt
    return Math.min(delay, this.maxDelayMs)
  }
}
