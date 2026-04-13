'use client'

import { useCallback, useRef, useState } from 'react'

export interface DimensionScore {
  dimensionId: string
  name: string
  score: number
}

export interface IterationSummary {
  version: number
  score: number
  dimensionScores: DimensionScore[]
  validationFailed: boolean
  artifact?: string | null
  costUSD?: number
  createdAt?: number
}

export type GenStatus =
  | 'idle'
  | 'starting'
  | 'generating'
  | 'presenting'
  | 'approved'
  | 'rejected'
  | 'error'

export interface TextGenerationState {
  status: GenStatus
  sessionId: string | null
  currentIteration: number
  maxIterations: number
  iterations: IterationSummary[]
  bestArtifact: string | null
  bestScore: number | null
  bestGrade: unknown | null
  totalCostUSD: number
  error: string | null
}

const INITIAL: TextGenerationState = {
  status: 'idle',
  sessionId: null,
  currentIteration: 0,
  maxIterations: 5,
  iterations: [],
  bestArtifact: null,
  bestScore: null,
  bestGrade: null,
  totalCostUSD: 0,
  error: null,
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const json = await response.clone().json()
    return json?.error?.message ?? json?.error ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

export function useTextGeneration() {
  const [state, setState] = useState<TextGenerationState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)
  const loopCompleteRef = useRef(false)

  const handleEvent = useCallback((event: string, data: Record<string, unknown>) => {
    if (event === 'loop_complete') loopCompleteRef.current = true
    setState((prev) => {
      switch (event) {
        case 'session':
          return {
            ...prev,
            sessionId: (data.sessionId as string) ?? prev.sessionId,
            maxIterations: (data.maxIterations as number) ?? prev.maxIterations,
            status: 'generating',
          }
        case 'iteration_start':
          return {
            ...prev,
            currentIteration: (data.iteration as number) ?? prev.currentIteration,
            status: 'generating',
          }
        case 'iteration_complete': {
          const it: IterationSummary = {
            version: data.iteration as number,
            score: (data.score as number) ?? 0,
            dimensionScores: (data.dimensionScores as DimensionScore[]) ?? [],
            validationFailed: Boolean(data.validationFailed),
            artifact: (data.artifact as string | null) ?? null,
            costUSD: (data.costUSD as number) ?? undefined,
          }
          return {
            ...prev,
            iterations: [...prev.iterations, it],
            totalCostUSD: (data.costUSD as number) ?? prev.totalCostUSD,
          }
        }
        case 'loop_complete':
          return {
            ...prev,
            status: data.status === 'approved' ? 'approved' : 'presenting',
            bestArtifact: (data.bestArtifact as string | null) ?? prev.bestArtifact,
            bestScore: (data.bestScore as number | null) ?? prev.bestScore,
            bestGrade: data.bestGrade ?? prev.bestGrade,
            totalCostUSD: (data.totalCostUSD as number) ?? prev.totalCostUSD,
            sessionId: (data.sessionId as string) ?? prev.sessionId,
          }
        case 'error':
          return { ...prev, status: 'error', error: (data.message as string) ?? 'Unknown error' }
        default:
          return prev
      }
    })
  }, [])

  const consumeStream = useCallback(
    async (response: Response) => {
      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      loopCompleteRef.current = false
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = chunk.split('\n')
            let event = 'message'
            let dataStr = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim()
              else if (line.startsWith('data: ')) dataStr += line.slice(6)
            }
            if (!dataStr) continue
            try {
              const data = JSON.parse(dataStr)
              handleEvent(event, data)
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // ignore
        }
      }
      if (!loopCompleteRef.current) {
        setState((p) =>
          p.status === 'generating' || p.status === 'starting'
            ? { ...p, status: 'error', error: 'Stream ended unexpectedly' }
            : p
        )
      }
    },
    [handleEvent]
  )

  const generate = useCallback(
    async (goal: string, opts?: { threshold?: number; maxIterations?: number }) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState({ ...INITIAL, status: 'starting' })
      try {
        const response = await fetch('/api/generate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, ...opts }),
          signal: controller.signal,
        })
        if (!response.ok) {
          const msg = await readErrorMessage(response)
          setState((p) => ({ ...p, status: 'error', error: msg }))
          return
        }
        await consumeStream(response)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState((p) => ({ ...p, status: 'error', error: (err as Error).message }))
      }
    },
    [consumeStream]
  )

  const submitReview = useCallback(
    async (action: 'approve' | 'feedback' | 'reject', feedback?: string) => {
      if (!state.sessionId) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        if (action === 'feedback') {
          setState((p) => ({ ...p, status: 'generating' }))
          const response = await fetch('/api/generate/text/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: state.sessionId, action, feedback }),
            signal: controller.signal,
          })
          if (!response.ok) {
            const msg = await readErrorMessage(response)
            setState((p) => ({ ...p, status: 'error', error: msg }))
            return
          }
          await consumeStream(response)
          return
        }

        const response = await fetch('/api/generate/text/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, action }),
          signal: controller.signal,
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          setState((p) => ({
            ...p,
            status: 'error',
            error: json?.error?.message ?? `HTTP ${response.status}`,
          }))
          return
        }
        setState((p) => ({
          ...p,
          status: action === 'approve' ? 'approved' : 'rejected',
        }))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState((p) => ({ ...p, status: 'error', error: (err as Error).message }))
      }
    },
    [state.sessionId, consumeStream]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((p) =>
      p.status === 'generating' || p.status === 'starting'
        ? { ...p, status: 'error', error: 'Cancelled' }
        : p
    )
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL)
  }, [])

  return { state, generate, submitReview, reset, cancel }
}
