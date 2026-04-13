'use client'

import { useCallback, useRef, useState } from 'react'
import type {
  TournamentEntry,
  TournamentEvent,
  TournamentResult,
} from '@/lib/core/engine/tournament-types'

export type ClientEntry = TournamentEntry & { imageUrl: string | null }

export type ClientResult = Omit<TournamentResult, 'winner' | 'bestEntry' | 'allEntries' | 'rounds'> & {
  winner: ClientEntry | null
  bestEntry: ClientEntry | null
  allEntries: ClientEntry[]
  rounds: { round: number; entries: ClientEntry[]; refinedPrompt?: string }[]
}

export type ImageGenStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'complete'
  | 'failed'
  | 'approved'
  | 'error'

export interface TournamentConfigInput {
  maxRounds?: number
  threshold?: number
  topN?: number
}

export interface FeedEntry {
  ts: number
  text: string
}

export interface ImageTournamentState {
  status: ImageGenStatus
  prompt: string
  currentRound: number
  maxRounds: number
  entries: ClientEntry[]
  feed: FeedEntry[]
  result: ClientResult | null
  costSoFar: number
  error: string | null
}

const INITIAL: ImageTournamentState = {
  status: 'idle',
  prompt: '',
  currentRound: 0,
  maxRounds: 0,
  entries: [],
  feed: [],
  result: null,
  costSoFar: 0,
  error: null,
}

function mergeEntry(prev: ClientEntry[], next: ClientEntry): ClientEntry[] {
  const idx = prev.findIndex((e) => e.modelId === next.modelId && e.round === next.round)
  if (idx === -1) return [...prev, next]
  const copy = prev.slice()
  copy[idx] = { ...copy[idx], ...next }
  return copy
}

function describeEvent(ev: TournamentEvent): string {
  const d = ev.data
  switch (ev.type) {
    case 'tournament:round-start':
      return `Round ${ev.round} started — ${d.totalEntries ?? '?'} models`
    case 'tournament:generation-complete':
      return `Round ${ev.round} generated (${d.totalEntries ?? '?'} total, ${d.failedGeneration ?? 0} failed)`
    case 'tournament:generation-failed':
      return `Round ${ev.round}: ${d.modelId} failed to generate`
    case 'tournament:validation-complete':
      return `Round ${ev.round} validated — ${d.passedValidation ?? 0}/${d.totalEntries ?? 0} passed`
    case 'tournament:entry-judged':
      return `${d.modelId} scored ${(d.score ?? 0).toFixed(2)}`
    case 'tournament:round-complete':
      return `Round ${ev.round} complete`
    case 'tournament:winner-selected':
      return `Winner: ${d.modelId} (${(d.score ?? 0).toFixed(2)})`
    case 'tournament:escalation':
      return `Escalation — best so far: ${d.modelId} (${(d.score ?? 0).toFixed(2)})`
    case 'tournament:all-failed':
      return `All models failed (${d.failedGeneration ?? 0} failures)`
    default:
      return ev.type
  }
}

export function useImageTournament() {
  const [state, setState] = useState<ImageTournamentState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)
  const gotResultRef = useRef(false)

  const handle = useCallback((eventName: string, data: unknown) => {
    if (eventName === 'session') {
      setState((p) => ({
        ...p,
        status: 'running',
        prompt: (data as { prompt?: string }).prompt ?? p.prompt,
        maxRounds: ((data as { config?: { maxRounds?: number } }).config?.maxRounds) ?? p.maxRounds,
      }))
      return
    }
    if (eventName === 'tournament') {
      const ev = data as TournamentEvent
      const line = describeEvent(ev)
      setState((p) => {
        let entries = p.entries
        let currentRound = p.currentRound
        let costSoFar = p.costSoFar

        if (ev.type === 'tournament:round-start') {
          currentRound = ev.round
        }
        if (typeof ev.data.costSoFar === 'number') {
          costSoFar = ev.data.costSoFar
        }
        if (ev.type === 'tournament:entry-judged' && ev.data.entry) {
          entries = mergeEntry(entries, ev.data.entry as ClientEntry)
        }
        return {
          ...p,
          currentRound,
          costSoFar,
          entries,
          feed: [...p.feed, { ts: Date.now(), text: line }].slice(-100),
        }
      })
      return
    }
    if (eventName === 'result') {
      gotResultRef.current = true
      const res = data as ClientResult
      setState((p) => {
        const mergedEntries = res.allEntries.reduce(
          (acc, e) => mergeEntry(acc, e),
          p.entries
        )
        const finalStatus: ImageGenStatus =
          res.method === 'all_failed' && !res.bestEntry ? 'failed' : 'complete'
        return {
          ...p,
          status: finalStatus,
          result: res,
          entries: mergedEntries,
          costSoFar: res.totalCostUsd,
        }
      })
      return
    }
    if (eventName === 'error') {
      const msg = (data as { message?: string }).message ?? 'Unknown error'
      setState((p) => ({ ...p, status: 'error', error: msg }))
      return
    }
  }, [])

  const consumeStream = useCallback(
    async (response: Response) => {
      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      gotResultRef.current = false
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
              handle(event, data)
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // noop
        }
      }
      if (!gotResultRef.current) {
        setState((p) =>
          p.status === 'running' || p.status === 'starting'
            ? { ...p, status: 'error', error: 'Stream ended unexpectedly' }
            : p
        )
      }
    },
    [handle]
  )

  const generate = useCallback(
    async (
      prompt: string,
      opts: { modelIds?: string[] } & TournamentConfigInput = {}
    ) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState({ ...INITIAL, status: 'starting', prompt })
      try {
        const response = await fetch('/api/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, ...opts }),
          signal: controller.signal,
        })
        if (!response.ok) {
          let msg = `HTTP ${response.status}`
          try {
            const json = await response.clone().json()
            msg = json?.error?.message ?? msg
          } catch {
            // ignore
          }
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

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((p) =>
      p.status === 'running' || p.status === 'starting'
        ? { ...p, status: 'error', error: 'Cancelled' }
        : p
    )
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL)
  }, [])

  const approve = useCallback(() => {
    setState((p) => ({ ...p, status: 'approved' }))
  }, [])

  return { state, generate, cancel, reset, approve }
}
