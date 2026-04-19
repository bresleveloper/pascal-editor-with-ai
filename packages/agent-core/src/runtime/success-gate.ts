/**
 * Success gate — validates that all acceptance criteria are met
 * before declaring success.
 */

export interface SuccessCriterion {
  name: string
  check: () => boolean | Promise<boolean>
}

export interface GateResult {
  passed: boolean
  results: Array<{
    name: string
    passed: boolean
  }>
}

export class SuccessGate {
  private criteria: SuccessCriterion[] = []

  add(criterion: SuccessCriterion): this {
    this.criteria.push(criterion)
    return this
  }

  async evaluate(): Promise<GateResult> {
    const results = await Promise.all(
      this.criteria.map(async (c) => ({
        name: c.name,
        passed: await c.check(),
      })),
    )

    return {
      passed: results.every((r) => r.passed),
      results,
    }
  }
}
