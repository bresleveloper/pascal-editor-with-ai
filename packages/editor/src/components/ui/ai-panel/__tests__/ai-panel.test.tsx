import { describe, expect, test } from 'bun:test'
import { AIChatPanel } from '../../ai-chat/ai-chat-panel'

describe('AIChatPanel', () => {
  test('AIChatPanel component is exported', () => {
    expect(AIChatPanel).toBeDefined()
    expect(typeof AIChatPanel).toBe('function')
  })
})