import { describe, expect, test } from 'bun:test'
import { AIPanel } from '@pascal/editor'

describe('AIPanel', () => {
  test('AIPanel component is exported', () => {
    expect(AIPanel).toBeDefined()
    expect(typeof AIPanel).toBe('function')
  })
})