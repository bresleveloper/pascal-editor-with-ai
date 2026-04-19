/**
 * Test matchers for agent results.
 */

import type { ImpactEntry, ValidationIssue, WallChangeResult } from '@pascal/scene-api'

export function matchWallResult(
  result: WallChangeResult,
  expectations: {
    success?: boolean
    minImpacts?: number
    maxErrors?: number
    hasWarnings?: boolean
  },
): { match: boolean; message: string } {
  const messages: string[] = []

  if (expectations.success !== undefined && result.success !== expectations.success) {
    messages.push(`Expected success=${expectations.success}, got ${result.success}`)
  }

  if (expectations.minImpacts !== undefined && result.impacts.length < expectations.minImpacts) {
    messages.push(
      `Expected at least ${expectations.minImpacts} impacts, got ${result.impacts.length}`,
    )
  }

  if (expectations.maxErrors !== undefined && result.errors.length > expectations.maxErrors) {
    messages.push(`Expected at most ${expectations.maxErrors} errors, got ${result.errors.length}`)
  }

  if (
    expectations.hasWarnings !== undefined &&
    result.warnings.length > 0 !== expectations.hasWarnings
  ) {
    messages.push(
      `Expected warnings=${expectations.hasWarnings}, got ${result.warnings.length} warnings`,
    )
  }

  return {
    match: messages.length === 0,
    message: messages.join('; ') || 'All expectations met',
  }
}

export function matchValidationIssues(
  issues: ValidationIssue[],
  expectations: {
    maxErrors?: number
    maxWarnings?: number
    specificCodes?: string[]
  },
): { match: boolean; message: string } {
  const messages: string[] = []
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  if (expectations.maxErrors !== undefined && errors.length > expectations.maxErrors) {
    messages.push(`Expected at most ${expectations.maxErrors} errors, got ${errors.length}`)
  }

  if (expectations.maxWarnings !== undefined && warnings.length > expectations.maxWarnings) {
    messages.push(`Expected at most ${expectations.maxWarnings} warnings, got ${warnings.length}`)
  }

  if (expectations.specificCodes) {
    for (const code of expectations.specificCodes) {
      if (!issues.some((i) => i.code === code)) {
        messages.push(`Expected issue code "${code}" not found`)
      }
    }
  }

  return {
    match: messages.length === 0,
    message: messages.join('; ') || 'All expectations met',
  }
}

export function matchImpactEntries(
  impacts: ImpactEntry[],
  expectations: {
    categories?: string[]
    minCount?: number
    maxCount?: number
  },
): { match: boolean; message: string } {
  const messages: string[] = []

  if (expectations.minCount !== undefined && impacts.length < expectations.minCount) {
    messages.push(`Expected at least ${expectations.minCount} impacts, got ${impacts.length}`)
  }

  if (expectations.maxCount !== undefined && impacts.length > expectations.maxCount) {
    messages.push(`Expected at most ${expectations.maxCount} impacts, got ${impacts.length}`)
  }

  if (expectations.categories) {
    for (const cat of expectations.categories) {
      if (!impacts.some((i) => i.category === cat)) {
        messages.push(`Expected impact category "${cat}" not found`)
      }
    }
  }

  return {
    match: messages.length === 0,
    message: messages.join('; ') || 'All expectations met',
  }
}
