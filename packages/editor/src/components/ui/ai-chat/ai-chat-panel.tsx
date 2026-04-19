'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * AI Chat Panel — a full conversation interface for the Pascal Agent.
 *
 * This is a fully self-contained React component with its own state management.
 * It provides:
 * - A scrollable message list with user/assistant/system messages
 * - A text input for sending prompts
 * - A dry-run/apply toggle
 * - Inline impact summaries and tool call results
 * - Confirmation prompts before applying changes
 * - Conversation memory (messages persist across interactions)
 *
 * To connect to the real agent backend, replace `simulateResponse` with
 * actual agent-core calls in `handleSubmit`.
 */

// ── Types ──────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  data?: ChatMessageData
  isStreaming?: boolean
}

export interface ChatMessageData {
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result?: unknown
  }>
  impacts?: Array<{
    category: string
    description: string
    severity: 'info' | 'warning' | 'error'
    affectedIds: string[]
  }>
  wallInfo?: {
    id: string
    name?: string
    length: number
    angle: number
    thickness?: number
    height?: number
    openings: string[]
  }
}

export type ChatStatus = 'idle' | 'thinking' | 'executing' | 'waiting_confirmation' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────────

export function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [input, setInput] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    planDescription: string
    impactSummary: string
    risks: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isLoading = status === 'thinking' || status === 'executing'

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const prompt = input.trim()
      setInput('')
      setError(null)

      // Add user message
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setStatus('thinking')

      // Simulate assistant processing
      const assistantId = `asst_${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ])

      setTimeout(() => {
        const isDryRunPrompt = dryRun || prompt.toLowerCase().includes('dry-run') || prompt.toLowerCase().includes('preview')
        const response = simulateResponse(prompt, isDryRunPrompt)

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: response.content, isStreaming: false, data: response.data }
              : m
          )
        )
        setStatus('idle')

        if (response.needsConfirmation && !isDryRunPrompt) {
          setPendingConfirmation({
            planDescription: response.content,
            impactSummary: response.data?.impacts?.map((i) => `${i.severity === 'error' ? '❌' : i.severity === 'warning' ? '⚠️' : 'ℹ️'} ${i.description}`).join('\n') ?? 'No impacts detected',
            risks: [],
          })
        }
      }, 800 + Math.random() * 500)
    },
    [input, isLoading, dryRun],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span>Pascal Agent</span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '9999px', background: status === 'idle' ? '#dcfce7' : status === 'error' ? '#fef2f2' : '#eff6ff', color: status === 'idle' ? '#166534' : status === 'error' ? '#991b1b' : '#1e40af' }}>
            {status === 'idle' ? 'Ready' : status === 'thinking' ? 'Thinking...' : status === 'executing' ? 'Executing...' : status === 'waiting_confirmation' ? 'Confirm?' : status === 'error' ? 'Error' : status}
          </span>
        </div>
        <button
          onClick={() => { setMessages([]); setStatus('idle'); setPendingConfirmation(null); setError(null); }}
          title="Clear conversation"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '4px' }}
        >
          🗑️
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏗️</div>
            <div>Ask me to modify your building scene.</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#d1d5db' }}>
              Try: &quot;move the kitchen wall out 40cm&quot; or &quot;inspect the north wall&quot;
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
            <TypingDot delay={0} />
            <TypingDot delay={0.2} />
            <TypingDot delay={0.4} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation prompt */}
      {pendingConfirmation && (
        <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#fffbeb' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ Confirm Action</div>
          <div style={{ marginBottom: '4px' }}>{pendingConfirmation.planDescription}</div>
          {pendingConfirmation.impactSummary && (
            <div style={{ fontSize: '12px', color: '#92400e', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {pendingConfirmation.impactSummary}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => { setPendingConfirmation(null); setStatus('idle'); }}
              style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Apply Changes
            </button>
            <button
              onClick={() => { setPendingConfirmation(null); setStatus('idle'); }}
              style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', borderTop: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px' }}>
          ❌ {error}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              placeholder={isLoading ? 'Processing...' : 'Describe what you want to do...'}
              disabled={isLoading}
              rows={1}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '13px',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4',
                minHeight: '36px',
                maxHeight: '120px',
                background: isLoading ? '#f9fafb' : 'white',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={isLoading}
              />
              Preview
            </label>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                padding: '8px 12px',
                background: dryRun ? '#3b82f6' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                opacity: isLoading || !input.trim() ? 0.6 : 1,
              }}
            >
              {dryRun ? 'Preview' : 'Apply'}
            </button>
          </div>
        </form>
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
          {dryRun ? '🔒 Preview mode — changes will be simulated, not applied' : '⚠️ Apply mode — changes will be applied to the scene'}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────────

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div style={{ padding: '6px 10px', background: '#f0f9ff', borderRadius: '6px', fontSize: '12px', color: '#1e40af', border: '1px solid #bfdbfe' }}>
        {message.content}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: '2px' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? '#3b82f6' : '#f3f4f6',
          color: isUser ? 'white' : '#111827',
          fontSize: '13px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {message.isStreaming && '▊'}
      </div>

      {/* Impact summary */}
      {message.data?.impacts && message.data.impacts.length > 0 && (
        <div style={{ maxWidth: '85%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '11px' }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '2px' }}>Impact</div>
          {message.data.impacts.map((impact, i) => (
            <div key={i} style={{ color: '#92400e' }}>
              {impact.severity === 'error' ? '❌' : impact.severity === 'warning' ? '⚠️' : 'ℹ️'} {impact.description}
            </div>
          ))}
        </div>
      )}

      {/* Wall info */}
      {message.data?.wallInfo && (
        <div style={{ maxWidth: '85%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', background: '#f0f9ff', border: '1px solid #bfdbfe', fontSize: '11px' }}>
          <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '2px' }}>
            🧱 {message.data.wallInfo.name ?? message.data.wallInfo.id}
          </div>
          <div style={{ color: '#3b82f6' }}>
            Length: {message.data.wallInfo.length.toFixed(2)}m • Angle: {(message.data.wallInfo.angle * 180 / Math.PI).toFixed(0)}°
            {message.data.wallInfo.openings.length > 0 && ` • Openings: ${message.data.wallInfo.openings.length}`}
          </div>
        </div>
      )}

      {/* Tool calls */}
      {message.data?.toolCalls && message.data.toolCalls.length > 0 && (
        <div style={{ maxWidth: '85%', marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
          {message.data.toolCalls.map((tc, i) => (
            <div key={i} style={{ padding: '2px 0' }}>
              🔧 {tc.name}({Object.entries(tc.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '10px', color: '#d1d5db' }}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#9ca3af',
        animation: 'typing 1.4s infinite ease-in-out both',
        animationDelay: `${delay}s`,
      }}
    />
  )
}

// ── Response simulator ──────────────────────────────────────────────────────────────
// In production, this gets replaced by the actual agent-core executor.

function simulateResponse(prompt: string, isDryRun: boolean): {
  content: string
  needsConfirmation: boolean
  data: ChatMessage['data']
} {
  const lower = prompt.toLowerCase()

  if (lower.includes('inspect') || lower.includes('show') || lower.includes('what')) {
    return {
      content: `I found the wall you're looking for. Here's what I see:\n\n**North Wall** (wall_kitchen_north)\n- Length: 4.00m\n- Angle: 0° (horizontal)\n- Thickness: 0.20m\n- Height: 2.80m\n- Interior side: interior\n- Exterior side: exterior\n- Openings: 1 window\n\n${isDryRun ? '🔍 This is a preview — no changes were made.' : ''}`,
      needsConfirmation: false,
      data: {
        wallInfo: {
          id: 'wall_kitchen_north',
          name: 'North Wall',
          length: 4.0,
          angle: 0,
          thickness: 0.2,
          height: 2.8,
          openings: ['window_kitchen_north'],
        },
      },
    }
  }

  if (lower.includes('move') || lower.includes('shift') || lower.includes('extend') || lower.includes('push')) {
    return {
      content: `I'll ${isDryRun ? 'simulate' : 'apply'} moving the wall:\n\n**Plan:** Extend the kitchen north wall by 40cm\n\n**Changes:**\n- Wall end: (4, 0) → (4.4, 0)\n- New length: 4.40m\n\n**Impacts Detected:**\n- 1 window on this wall may need repositioning\n- 1 connected wall may be affected\n\n${isDryRun ? '🔒 Dry-run complete — no changes applied.\n\nTo apply this change, uncheck "Preview" and submit again.' : '✅ Changes applied to the scene.'}`,
      needsConfirmation: !isDryRun,
      data: {
        impacts: [
          { category: 'opening_bounds_violation', description: '1 window on this wall may need repositioning (window_kitchen_north, width 1.5m)', severity: 'warning' as const, affectedIds: ['window_kitchen_north'] },
          { category: 'connected_wall_endpoint', description: '1 connected wall shares an endpoint with this wall', severity: 'info' as const, affectedIds: ['wall_kitchen_west'] },
        ],
      },
    }
  }

  if (lower.includes('validate') || lower.includes('check') || lower.includes('error')) {
    return {
      content: `I've validated the scene. Here's what I found:\n\n✅ No errors detected\n⚠️ 1 warning: Wall kitchen_west and kitchen_north share an endpoint\nℹ️ 7 walls, 1 window, 1 zone\n\nThe scene looks structurally sound.`,
      needsConfirmation: false,
      data: undefined,
    }
  }

  return {
    content: `I understand you want to: "${prompt}"\n\nI can help you with:\n- **Inspect** a wall: "inspect the north wall"\n- **Move** a wall: "move the kitchen wall out 40cm"\n- **Validate** the scene: "validate"\n- **Resolve** a reference: "the north wall of the kitchen"\n\nWhat would you like to do?`,
    needsConfirmation: false,
    data: undefined,
  }
}

export default AIChatPanel