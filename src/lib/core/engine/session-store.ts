// In-memory session store for the text-generation proving UI.
// NOTE: Volatile by design — dies on server restart. Sufficient for Phase 3.5
// proving UI; swap for Prisma-backed persistence when we productionise.
// Without auth, sessionId is a bearer token → we mint 122-bit UUIDs so the
// space is infeasible to guess.

import { randomUUID } from 'crypto'
import type { LoopState } from './types'

export interface TextSession {
  sessionId: string
  goal: string
  systemPrompt: string
  state: LoopState<string>
  totalCostUSD: number
  createdAt: number
}

const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour
const sessions = new Map<string, TextSession>()

export function createSessionId(): string {
  return `sess_${randomUUID()}`
}

export function saveSession(session: TextSession): void {
  sessions.set(session.sessionId, session)
  sweepExpired()
}

export function loadSession(sessionId: string): TextSession | undefined {
  return sessions.get(sessionId)
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}

function sweepExpired(now: number = Date.now()): void {
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id)
  }
}

// Exposed for tests.
export function __resetSessionsForTest(): void {
  sessions.clear()
}
