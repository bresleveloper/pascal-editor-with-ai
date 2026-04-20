'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sendToAgent, localFallback, DEFAULT_CONFIG, type AgentConfig } from '../../../lib/agent/agent-service'
import type { ChatMessage, ChatMessageData } from '../../../store/use-chat'

/**
 * AI Chat Panel — a full conversation interface for the Pascal Agent.
 *
 * Connects to Ollama for LLM-powered scene editing.
 * Falls back to local pattern matching when Ollama is unavailable.
 * Can create houses, rooms, walls, windows, doors, zones — everything.
 */

export interface AIChatPanelProps {
  /** Ollama configuration override */
  agentConfig?: Partial<AgentConfig>
}

export function AIChatPanel({ agentConfig }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<'idle' | 'thinking' | 'executing' | 'error'>('idle')
  const [input, setInput] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const config = { ...DEFAULT_CONFIG, ...agentConfig }

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || status === 'thinking' || status === 'executing') return

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

      // Add placeholder assistant message
      const assistantId = `asst_${Date.now()}`
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
      ])

      try {
        // Try local pattern matching first (instant, no LLM needed)
        const localResult = localFallback(prompt)

        if (localResult) {
          // Local pattern matched — we have a result without LLM
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: localResult.success
                      ? `✅ ${localResult.message}\n\n*(Executed locally — no LLM needed)*`
                      : `❌ ${localResult.message}`,
                    isStreaming: false,
                    data: {
                      impacts: localResult.impacts,
                    },
                  }
                : m
            )
          )
          setStatus('idle')
          return
        }

        // No local match — try LLM via Ollama
        setStatus('executing')

        const result = await sendToAgent(prompt, messages, config, (progress) => {
          // Update the streaming message with progress
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `⏳ ${progress}...`, isStreaming: true }
                : m
            )
          )
        })

        // Update with final response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.content,
                  isStreaming: false,
                  data: result.impacts ? { impacts: result.impacts } : undefined,
                }
              : m
          )
        )
        setStatus('idle')
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)

        // If Ollama failed and local didn't match, show helpful message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `I couldn't process that request. Here are some things I can do:\n\n🏠 **Create a house**: "create a house", "make a building 10x8"\n🏠 **Create a room**: "add a room called Kitchen 4x3"\n🧱 **Add a wall**: "add a wall from (0,0) to (5,0)"\n🪟 **Add a window**: "add a window on the north wall"\n🚪 **Add a door**: "add a door on the south wall"\n📋 **View scene**: "show me the scene", "what's in the scene?"\n🔍 **Inspect a wall**: "inspect the north wall"\n\n💡 For smarter responses, make sure Ollama is running:\n\`\`\`bash\nollama serve\nollama pull llama3.2\n\`\`\`\n\nError: ${errorMsg}`,
                  isStreaming: false,
                }
              : m
          )
        )
        setStatus('idle')
      }
    },
    [input, status, messages, config],
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  const isLoading = status === 'thinking' || status === 'executing'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span>Pascal Agent</span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '9999px', background: status === 'idle' ? '#dcfce7' : status === 'error' ? '#fef2f2' : '#eff6ff', color: status === 'idle' ? '#166534' : status === 'error' ? '#991b1b' : '#1e40af' }}>
            {status === 'idle' ? 'Ready' : status === 'thinking' ? 'Thinking...' : status === 'executing' ? 'Executing...' : status === 'error' ? 'Error' : status}
          </span>
          <span style={{ fontSize: '9px', color: '#9ca3af' }}>
            {config.model}@{config.baseUrl.replace('http://', '').replace('https://', '')}
          </span>
        </div>
        <button
          onClick={clearChat}
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
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏗️</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Pascal Agent</div>
            <div style={{ fontSize: '12px', marginBottom: '12px' }}>I can create buildings, rooms, walls, windows, doors — anything.</div>
            <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'left', background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Try these:</div>
              <div>🏠 "create a house"</div>
              <div>🏠 "make a house 10 by 8"</div>
              <div>🚪 "add a room called Kitchen 4x3"</div>
              <div>🧱 "add a wall from (0,0) to (5,0)"</div>
              <div>📋 "show me the scene"</div>
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

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', borderTop: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px' }}>
          ❌ {error}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              placeholder={isLoading ? 'Processing...' : 'Create a house, add a room, move a wall...'}
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
                background: 'transparent',
                color: 'inherit',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              opacity: isLoading || !input.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? '⏳' : '→'} Send
          </button>
        </form>
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
          Powered by {config.model} via Ollama • Patterns work offline • LLM for complex requests
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
          {message.data.impacts.map((impact: { severity: string; description: string }, i: number) => (
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
          {message.data.toolCalls.map((tc: { name: string; args: Record<string, unknown> }, i: number) => (
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

export default AIChatPanel