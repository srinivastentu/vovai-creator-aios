import { z } from 'zod'
import {
  createTextGenerationStage,
  type TextStageContext,
} from '@/lib/core/agentic/stages/text-generation-stage'
import { runTextLoop } from '@/lib/core/agentic/stages/run-text-loop'
import { createSSEStream, SSE_HEADERS } from '@/lib/core/engine/sse-stream'
import {
  createSessionId,
  saveSession,
} from '@/lib/core/engine/session-store'
import { consumeToken, clientIp } from '@/lib/core/engine/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  goal: z.string().min(3).max(500),
  systemPrompt: z.string().max(4000).optional(),
  threshold: z.number().min(0).max(10).optional(),
  maxIterations: z.number().int().min(1).max(10).optional(),
})

const DEFAULT_SYSTEM_PROMPT =
  'You are an expert technical writer. Produce a clear, well-structured article in Markdown. ' +
  'Use headings, short paragraphs, concrete examples, and accurate facts.'

export async function POST(request: Request) {
  const rate = consumeToken(clientIp(request))
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({ success: false, data: null, error: { message: 'Rate limit exceeded' } }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(rate.retryAfterMs / 1000).toString(),
        },
      }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', issues: parsed.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { goal, systemPrompt, threshold, maxIterations } = parsed.data
  const sessionId = createSessionId()
  const sse = createSSEStream()

  const stage = createTextGenerationStage({
    threshold,
    maxIterations,
  })

  const context: TextStageContext = {
    goal,
    systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
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

  sse.send('session', { sessionId, goal, maxIterations: stage.stage.maxIterations })
  sse.send('iteration_start', { iteration: 1 })

  ;(async () => {
    try {
      const result = await runTextLoop({
        stage,
        context,
        onShouldCancel: () => cancelled,
        onIteration: (event) => {
          if (cancelled) return
          sse.send('iteration_complete', {
            iteration: event.version,
            score: event.score,
            dimensionScores: event.dimensionScores,
            validationFailed: event.validationFailed,
            artifact: event.artifact ?? null,
            costUSD: stage.getTotalCostUSD(),
          })
          if (!event.validationFailed) {
            sse.send('iteration_start', { iteration: event.version + 1 })
          }
        },
      })

      if (cancelled) return

      saveSession({
        sessionId,
        goal,
        systemPrompt: context.systemPrompt,
        state: result.finalState,
        totalCostUSD: result.totalCostUSD,
        createdAt: Date.now(),
      })

      sse.send('loop_complete', {
        sessionId,
        bestArtifact: result.bestArtifact,
        bestScore: result.bestScore,
        bestGrade: result.finalState.bestGrade ?? null,
        iterations: result.iterations.map((it) => ({
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
        totalCostUSD: result.totalCostUSD,
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
