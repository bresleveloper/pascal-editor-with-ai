/**
 * Blocker policy — classifies failures as fixable or true blockers.
 */

export type FailureClassification = 'fixable' | 'blocker' | 'unknown'

// Patterns that indicate a true blocker (external issue)
const BLOCKER_PATTERNS: RegExp[] = [
  /missing credentials/i,
  /api key/i,
  /unauthorized/i,
  /forbidden/i,
  /payment required/i,
  /external.*unavailable/i,
  /cannot connect/i,
  /timeout.*external/i,
  /legal.*approval/i,
  /security.*approval/i,
  /destructive.*requires.*consent/i,
]

// Patterns that indicate a fixable (transient) error
const FIXABLE_PATTERNS: RegExp[] = [
  /network/i,
  /timeout/i,
  /rate limit/i,
  /retry/i,
  /transient/i,
  /temporary/i,
]

export class BlockerPolicy {
  /**
   * Classify a failure message as fixable, blocker, or unknown.
   */
  classify(errorMessage: string): FailureClassification {
    // Check blocker patterns first
    for (const pattern of BLOCKER_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return 'blocker'
      }
    }

    // Check fixable patterns
    for (const pattern of FIXABLE_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return 'fixable'
      }
    }

    // Default to unknown (will be retried)
    return 'unknown'
  }
}
