'use client'

import { useState, useCallback } from 'react'

/**
 * AI Panel — thin React component for the editor.
 * Provides prompt input, target preview, impact summary,
 * dry-run/apply toggle, and execution log.
 */

export interface AIPanelProps {
  /** Called when user submits a prompt */
  onSubmitPrompt: (prompt: string, options: { dryRun: boolean }) => void
  /** Whether the agent is currently processing */
  isLoading?: boolean
  /** The last result to display */
  result?: AIPanelResult | null
  /** Whether to show advanced options */
  showAdvanced?: boolean
}

export interface AIPanelResult {
  summary?: string
  targetId?: string
  targetName?: string
  impacts?: Array<{
    category: string
    description: string
    severity: 'info' | 'warning' | 'error'
  }>
  warnings?: string[]
  errors?: string[]
  diff?: {
    added: number
    removed: number
    modified: number
  }
}

export function AIPanel({
  onSubmitPrompt,
  isLoading = false,
  result = null,
  showAdvanced = false,
}: AIPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [dryRun, setDryRun] = useState(true)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!prompt.trim() || isLoading) return
      onSubmitPrompt(prompt.trim(), { dryRun })
    },
    [prompt, dryRun, isLoading, onSubmitPrompt],
  )

  return (
    <div className="ai-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', padding: '12px', fontSize: '13px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
        <span>🤖 Pascal Agent</span>
        {isLoading && <span style={{ color: '#888' }}>Processing...</span>}
      </div>

      {/* Prompt Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to do..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          style={{
            padding: '8px 12px',
            backgroundColor: dryRun ? '#3b82f6' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {dryRun ? 'Preview' : 'Apply'}
        </button>
      </form>

      {/* Dry-run toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#666' }}>
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          disabled={isLoading}
        />
        Dry-run (simulate without applying)
      </label>

      {/* Target Preview */}
      {result?.targetId && (
        <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>Target</div>
          <div>{result.targetName || result.targetId}</div>
        </div>
      )}

      {/* Impact Summary */}
      {result?.impacts && result.impacts.length > 0 && (
        <div style={{ padding: '8px', backgroundColor: '#fffbeb', borderRadius: '4px', border: '1px solid #fcd34d' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>Impact ({result.impacts.length})</div>
          {result.impacts.map((impact, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#92400e' }}>
              {impact.severity === 'error' ? '❌' : impact.severity === 'warning' ? '⚠️' : 'ℹ️'} {impact.description}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result?.warnings && result.warnings.length > 0 && (
        <div style={{ padding: '8px', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#92400e' }}>⚠️ {w}</div>
          ))}
        </div>
      )}

      {/* Errors */}
      {result?.errors && result.errors.length > 0 && (
        <div style={{ padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px', border: '1px solid #fca5a5' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#991b1b' }}>❌ {e}</div>
          ))}
        </div>
      )}

      {/* Diff Summary */}
      {result?.diff && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          Changes: +{result.diff.added} added, -{result.diff.removed} removed, ~{result.diff.modified} modified
        </div>
      )}

      {/* Summary */}
      {result?.summary && (
        <div style={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap' }}>
          {result.summary}
        </div>
      )}

      {/* Advanced options (collapsible) */}
      {showAdvanced && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Advanced</div>
          <div>Provider: mock (deterministic)</div>
          <div>Model: —</div>
        </div>
      )}
    </div>
  )
}

export default AIPanel