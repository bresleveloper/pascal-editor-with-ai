'use client'

import { create } from 'zustand'

/**
 * Chat message types for the AI conversation panel.
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  /** For assistant messages — structured data from tool calls */
  data?: ChatMessageData
  /** Whether this message is currently being streamed */
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

export interface ChatState {
  /** All messages in the conversation */
  messages: ChatMessage[]
  /** Current processing status */
  status: ChatStatus
  /** The current pending confirmation (if any) */
  pendingConfirmation: {
    planDescription: string
    impactSummary: string
    risks: string[]
  } | null
  /** Error message if status is 'error' */
  error: string | null
  /** Provider name for display */
  providerName: string

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setStatus: (status: ChatStatus) => void
  setPendingConfirmation: (confirmation: ChatState['pendingConfirmation']) => void
  confirmAction: () => void
  cancelAction: () => void
  clearChat: () => void
  setError: (error: string | null) => void
}

let messageCounter = 0

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: 'idle',
  pendingConfirmation: null,
  error: null,
  providerName: 'mock',

  addMessage: (message) => {
    const id = `msg_${++messageCounter}_${Date.now()}`
    const fullMessage: ChatMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, fullMessage] }))
    return id
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }))
  },

  setStatus: (status) => set({ status }),

  setPendingConfirmation: (confirmation) =>
    set({
      pendingConfirmation: confirmation,
      status: confirmation ? 'waiting_confirmation' : get().status,
    }),

  confirmAction: () => set({ pendingConfirmation: null, status: 'idle' }),

  cancelAction: () => set({ pendingConfirmation: null, status: 'idle' }),

  clearChat: () => set({ messages: [], status: 'idle', pendingConfirmation: null, error: null }),

  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
}))
