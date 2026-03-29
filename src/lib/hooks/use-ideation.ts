'use client'

import { useState, useCallback, useRef } from 'react'
import { useApiMutation } from './use-api'
import type { BrainstormRole, IdeationPhase } from '@/lib/project-component'

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
  refetchMessages: () => Promise<void>
  refetchBlueprint: () => Promise<void>
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
    try {
      await startMutation.mutate({ brief })
      await refetchAll()
    } finally {
      setActiveAgents([])
    }
  }, [blueprintId, startMutation, refetchAll])

  // ── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async (message: string) => {
    if (!blueprintId) return
    const key = `message_${phaseRef.current}`
    setActiveAgents(AGENTS_BY_ACTION[key] ?? AGENTS_BY_ACTION.message_brainstorm)
    try {
      await messageMutation.mutate({ message })
      await refetchAll()
    } finally {
      setActiveAgents([])
    }
  }, [blueprintId, messageMutation, refetchAll])

  // ── Grade ──────────────────────────────────────────────────────────────

  const gradeStructure = useCallback(async () => {
    if (!blueprintId) return
    setActiveAgents(AGENTS_BY_ACTION.grade)
    try {
      await gradeMutation.mutate({} as Record<string, never>)
      await refetchAll()
    } finally {
      setActiveAgents([])
    }
  }, [blueprintId, gradeMutation, refetchAll])

  // ── Review ─────────────────────────────────────────────────────────────

  const submitReview = useCallback(async (
    action: 'approve' | 'feedback' | 'restructure',
    message?: string
  ) => {
    if (!blueprintId) return
    setActiveAgents(AGENTS_BY_ACTION.review)
    try {
      await approveMutation.mutate({ action, message })
      await refetchAll()
    } finally {
      setActiveAgents([])
    }
  }, [blueprintId, approveMutation, refetchAll])

  // ── Derived ────────────────────────────────────────────────────────────

  const anyLoading =
    startMutation.loading ||
    messageMutation.loading ||
    gradeMutation.loading ||
    approveMutation.loading

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
  }
}
