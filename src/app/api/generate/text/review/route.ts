import { z } from 'zod'
import {
  createTextGenerationStage,
  type TextStageContext,
} from '@/lib/core/agentic/stages/text-generation-stage'
import { runTextLoop } from '@/lib/core/agentic/stages/run-text-loop'
import { processReview } from '@/lib/core/engine/loop-engine'
import type { ReviewAction } from '@/lib/core/engine/types'
import { createSSEStream, SSE_HEADERS } from '@/lib/core/engine/sse-stream'
import {
  deleteSession,
  loadSession,
  saveSession,
} from '@/lib/core/engine/session-store'
import { consumeToken, clientIp } from '@/lib/core/engine/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    sessionId: z.string().min(1),
    action: z.enum(['approve', 'feedback', 'reject']),
    feedback: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'feedback' && (!val.feedback || val.feedback.trim().length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['feedback'],
        message: 'feedback is required when action is "feedback"',
      })
    }
  })

export async function POST(request: Request) {
  const rate = consumeToken(clientIp(request))
  if (!rate.allowed) {
    return jsonError('Rate limit exceeded', 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Validation failed', 400, parsed.error.issues)
  }

  const { sessionId, action, feedback } = parsed.data
  const session = loadSession(sessionId)
  if (!session) return jsonError('Session not found', 404)

  const reviewAction: ReviewAction =
    action === 'feedback'
      ? { type: 'feedback', message: feedback ?? '' }
      : action === 'approve'
        ? { type: 'approve' }
        : { type: 'reject' }

  if (action === 'approve') {
    const newState = processReview(session.state, reviewAction)
    const payload = {
      sessionId,
      status: newState.status,
      bestArtifact: newState.bestArtifact,
      bestScore: newState.bestGrade?.overallScore ?? null,
      totalCostUSD: session.totalCostUSD,
    }
    deleteSession(sessionId)
    return new Response(
      JSON.stringify({ success: true, data: payload, error: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (action === 'reject') {
    const newState = processReview(session.state, reviewAction)
    const payload = { sessionId, status: newState.status }
    deleteSession(sessionId)
    return new Response(
      JSON.stringify({ success: true, data: payload, error: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Feedback: transition state, then re-drive loop once via runTextLoop.
  const postReviewState = processReview(session.state, reviewAction)
  const sse = createSSEStream()

  const stage = createTextGenerationStage()

  const context: TextStageContext = {
    goal: session.goal,
    systemPrompt: session.systemPrompt,
  }

  let cancelled = false
  const signal = request.signal
  if (signal) {
    if (signal.aborted) cancelled = true
    else signal.addEventListener('abort', () => {
      cancelled = true
      sse.close()
    })
  }

  const alreadySeen = postReviewState.iterations.length

  sse.send('session', { sessionId, resuming: true })
  sse.send('iteration_start', { iteration: alreadySeen + 1 })

  ;(async () => {
    try {
      const result = await runTextLoop({
        stage,
        context,
        initialState: postReviewState,
        onShouldCancel: () => cancelled,
        onIteration: (event) => {
          if (cancelled) return
          // Only stream newly-produced iterations.
          if (event.version <= alreadySeen) return
          sse.send('iteration_complete', {
            iteration: event.version,
            score: event.score,
            dimensionScores: event.dimensionScores,
            validationFailed: event.validationFailed,
            artifact: event.artifact ?? null,
            costUSD: session.totalCostUSD + stage.getTotalCostUSD(),
          })
          if (!event.validationFailed) {
            sse.send('iteration_start', { iteration: event.version + 1 })
          }
        },
      })

      if (cancelled) return

      const newTotal = session.totalCostUSD + stage.getTotalCostUSD()
      saveSession({ ...session, state: result.finalState, totalCostUSD: newTotal })

      sse.send('loop_complete', {
        sessionId,
        bestArtifact: result.finalState.bestArtifact,
        bestScore: result.finalState.bestGrade?.overallScore ?? null,
        bestGrade: result.finalState.bestGrade ?? null,
        iterations: result.finalState.iterations.map((it) => ({
          version: it.version,
          score: it.grade?.overallScore ?? 0,
          dimensionScores:
            it.grade?.dimensionScores.map((d) => ({
              dimensionId: d.dimensionId,
              name: d.name,
              score: d.score,
            })) ?? [],
          createdAt: it.createdAt,
        })),
        totalCostUSD: newTotal,
        status: result.finalState.status,
        error: result.error ?? null,
      })
    } catch (err) {
      if (cancelled) return
      const message = err instanceof Error ? err.message : String(err)
      sse.send('error', { message })
    } finally {
      sse.close()
    }
  })()

  return new Response(sse.readable, { headers: SSE_HEADERS })
}

function jsonError(message: string, status: number, details?: unknown): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { message, details } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}
