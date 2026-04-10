'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useApiMutation } from './use-api'
import type { BrainstormRole, IdeationPhase } from '@/lib/domain/workflows'

// ─── API Response Types ────────────────────────────────────────────────────

interface StartResponse {
  conversationId: string
  phase: IdeationPhase
  archetype: string | null
  awaitingHuman: boolean
  message: string
  costUSD: number
}

interface MessageResponse {
  conversationId: string
  phase: IdeationPhase
  archetype: string | null
  awaitingHuman: boolean
  message: string
  costUSD: number
  messages: unknown[]
}

interface GradeResponse {
  conversationId: string
  phase: IdeationPhase
  loopCount: number
  gradeReport: Record<string, unknown> | null
  awaitingHuman: boolean
  message: string
  costUSD: number
}

interface ApproveResponse {
  conversationId: string
  action: string
  phase: IdeationPhase
  awaitingHuman: boolean
  message: string
  costUSD: number
  messages: unknown[]
}

// ─── Active Agent Mappings ─────────────────────────────────────────────────

const AGENTS_BY_ACTION: Record<string, BrainstormRole[]> = {
  start: ['facilitator', 'researcher', 'pedagogy_expert', 'audience_analyst'],
  message_brainstorm: ['facilitator'],
  message_structure: ['facilitator', 'structure_architect'],
  message_refinement: ['facilitator', 'structure_architect'],
  grade: ['structure_architect', 'critic', 'synthesizer'],
  review: ['facilitator'],
}

// ─── Hook Input/Output ─────────────────────────────────────────────────────

interface UseIdeationInput {
  blueprintId: string | null
  currentPhase: IdeationPhase
  hasConversation: boolean
  refetchMessages: () => Promise<unknown>
  refetchBlueprint: () => Promise<unknown>
}

export interface UseIdeationReturn {
  startIdeation: (brief: string) => Promise<void>
  startLoading: boolean
  startError: string | null

  sendMessage: (message: string) => Promise<void>
  sendLoading: boolean
  sendError: string | null

  gradeStructure: () => Promise<void>
  gradeLoading: boolean
  gradeError: string | null

  submitReview: (action: 'approve' | 'feedback' | 'restructure', message?: string) => Promise<void>
  reviewLoading: boolean
  reviewError: string | null

  anyLoading: boolean
  activeAgents: BrainstormRole[]
  currentAction: string | null
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useIdeation({
  blueprintId,
  currentPhase,
  hasConversation,
  refetchMessages,
  refetchBlueprint,
}: UseIdeationInput): UseIdeationReturn {
  const [activeAgents, setActiveAgents] = useState<BrainstormRole[]>([])
  const [currentAction, setCurrentAction] = useState<string | null>(null)

  // Keep current phase in a ref so handlers always see the latest value
  const phaseRef = useRef(currentPhase)
  phaseRef.current = currentPhase

  const baseUrl = blueprintId ? `/api/blueprints/${blueprintId}/ideation` : ''

  const startMutation = useApiMutation<{ brief: string }, StartResponse>(
    `${baseUrl}/start`
  )
  const messageMutation = useApiMutation<{ message: string }, MessageResponse>(
    `${baseUrl}/message`
  )
  const gradeMutation = useApiMutation<Record<string, never>, GradeResponse>(
    `${baseUrl}/grade`
  )
  const approveMutation = useApiMutation<
    { action: string; message?: string },
    ApproveResponse
  >(`${baseUrl}/approve`)

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchMessages(), refetchBlueprint()])
  }, [refetchMessages, refetchBlueprint])

  // ── Start ──────────────────────────────────────────────────────────────

  const startIdeation = useCallback(async (brief: string) => {
    if (!blueprintId || !brief) return
    setActiveAgents(AGENTS_BY_ACTION.start)
    setCurrentAction('start')
    try {
      await startMutation.mutate({ brief })
      await refetchAll()
    } finally {
      setActiveAgents([])
      setCurrentAction(null)
    }
  }, [blueprintId, startMutation, refetchAll])

  // ── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async (message: string) => {
    if (!blueprintId) return
    const key = `message_${phaseRef.current}`
    setActiveAgents(AGENTS_BY_ACTION[key] ?? AGENTS_BY_ACTION.message_brainstorm)
    setCurrentAction(key)
    try {
      await messageMutation.mutate({ message })
      await refetchAll()
    } finally {
      setActiveAgents([])
      setCurrentAction(null)
    }
  }, [blueprintId, messageMutation, refetchAll])

  // ── Grade ──────────────────────────────────────────────────────────────

  const gradeStructure = useCallback(async () => {
    if (!blueprintId) return
    setActiveAgents(AGENTS_BY_ACTION.grade)
    setCurrentAction('grade')
    try {
      await gradeMutation.mutate({} as Record<string, never>)
      await refetchAll()
    } finally {
      setActiveAgents([])
      setCurrentAction(null)
    }
  }, [blueprintId, gradeMutation, refetchAll])

  // ── Review ─────────────────────────────────────────────────────────────

  const submitReview = useCallback(async (
    action: 'approve' | 'feedback' | 'restructure',
    message?: string
  ) => {
    if (!blueprintId) return
    setActiveAgents(AGENTS_BY_ACTION.review)
    setCurrentAction('review')
    try {
      await approveMutation.mutate({ action, message })
      await refetchAll()
    } finally {
      setActiveAgents([])
      setCurrentAction(null)
    }
  }, [blueprintId, approveMutation, refetchAll])

  // ── Safety: force-clear stale active agents ─────────────────────────
  // If activeAgents is set but no mutation is loading, clear it.
  // This handles edge cases where the finally block doesn't fire
  // (e.g., component re-mount during async operation).
  const mutationLoading =
    startMutation.loading ||
    messageMutation.loading ||
    gradeMutation.loading ||
    approveMutation.loading

  useEffect(() => {
    if (!mutationLoading && activeAgents.length > 0) {
      const timer = setTimeout(() => {
        setActiveAgents([])
        setCurrentAction(null)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [mutationLoading, activeAgents.length])

  // ── Derived ────────────────────────────────────────────────────────────

  const anyLoading = mutationLoading

  return {
    startIdeation,
    startLoading: startMutation.loading,
    startError: startMutation.error,

    sendMessage,
    sendLoading: messageMutation.loading,
    sendError: messageMutation.error,

    gradeStructure,
    gradeLoading: gradeMutation.loading,
    gradeError: gradeMutation.error,

    submitReview,
    reviewLoading: approveMutation.loading,
    reviewError: approveMutation.error,

    anyLoading,
    activeAgents,
    currentAction,
  }
}
