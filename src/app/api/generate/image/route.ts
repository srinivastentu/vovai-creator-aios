import { basename } from 'node:path'
import { z } from 'zod'
import { createSSEStream, SSE_HEADERS } from '@/lib/core/engine/sse-stream'
import { consumeToken, clientIp } from '@/lib/core/engine/rate-limit'
import { createTournamentRunner } from '@/lib/core/engine/tournament'
import type {
  TournamentConfig,
  TournamentEntry,
  TournamentEvent,
  TournamentResult,
} from '@/lib/core/engine/tournament-types'
import { getDefaultGateway } from '@/lib/core/models/default-gateway'
import { createImageJudge } from '@/lib/core/agentic/judges/image-judge'
import { imageRubric } from '@/lib/core/agentic/judges/image-rubric'
import { createImageValidators } from '@/lib/core/agentic/validators/image-validators'
import { pickClosestResolution, resolutionsEqual } from '@/lib/core/models/resolution-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  modelIds: z.array(z.string().min(1)).min(1).optional(),
  maxRounds: z.number().int().min(1).max(3).optional(),
  threshold: z.number().min(5).max(10).optional(),
  topN: z.number().int().min(1).max(3).optional(),
  timeoutPerModelMs: z.number().int().min(10_000).max(300_000).optional(),
  width: z.number().int().min(256).max(4096).optional(),
  height: z.number().int().min(256).max(4096).optional(),
})

const DEFAULTS = {
  maxRounds: 2,
  threshold: 7.5,
  topN: 2,
  timeoutPerModelMs: 120_000,
}

function jsonError(message: string, status: number, details?: unknown): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { message, details } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

function imageUrlFromPath(imagePath: string | undefined | null): string | null {
  if (!imagePath || typeof imagePath !== 'string') return null
  const name = basename(imagePath)
  if (!name) return null
  return `/api/images/${encodeURIComponent(name)}`
}

const MAX_SHORT_ERROR = 120

function humanizeError(raw: string | undefined | null): string | null {
  if (!raw) return null
  const text = String(raw)
  const lower = text.toLowerCase()
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) {
    const retryMatch = text.match(/retry[^\d]*(\d+)\s*s/i)
    const suffix = retryMatch ? ` Retry in ~${retryMatch[1]}s or upgrade API plan.` : ' Upgrade API plan or retry later.'
    return `Rate limited — provider quota exceeded.${suffix}`
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'Model not found on provider API (check model ID or availability).'
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Provider timed out. Try again.'
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'Provider auth failed (check API key).'
  }
  if (text.length <= MAX_SHORT_ERROR) return text
  return text.slice(0, MAX_SHORT_ERROR - 1).trimEnd() + '…'
}

function enrichEntry(entry: TournamentEntry): TournamentEntry & { imageUrl: string | null; errorShort: string | null } {
  return {
    ...entry,
    imageUrl: imageUrlFromPath(entry.artifact?.imagePath),
    errorShort: humanizeError(entry.gatewayResponse?.error),
  }
}

function enrichEvent(event: TournamentEvent): TournamentEvent {
  const data = { ...event.data }
  if (data.entry) {
    data.entry = enrichEntry(data.entry) as TournamentEntry
  }
  return { ...event, data }
}

function enrichResult(result: TournamentResult): TournamentResult {
  return {
    ...result,
    winner: result.winner ? (enrichEntry(result.winner) as TournamentEntry) : null,
    bestEntry: result.bestEntry ? (enrichEntry(result.bestEntry) as TournamentEntry) : null,
    allEntries: result.allEntries.map((e) => enrichEntry(e) as TournamentEntry),
    rounds: result.rounds.map((r) => ({
      ...r,
      entries: r.entries.map((e) => enrichEntry(e) as TournamentEntry),
    })),
  }
}

export async function POST(request: Request): Promise<Response> {
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
    return jsonError('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Validation failed', 400, parsed.error.issues)
  }

  const gateway = getDefaultGateway()
  const available = gateway.getAvailableModels('image-generation')
  if (available.length === 0) {
    return jsonError('No image-generation models available', 503)
  }

  const requested = parsed.data.modelIds ?? available.map((m) => m.id)
  const availableIds = new Set(available.map((m) => m.id))
  const invalid = requested.filter((id) => !availableIds.has(id))
  if (invalid.length > 0) {
    return jsonError(`Unknown model IDs: ${invalid.join(', ')}`, 400)
  }

  const targetWidth = parsed.data.width ?? 1024
  const targetHeight = parsed.data.height ?? 1024
  const target = { width: targetWidth, height: targetHeight }

  const requestedModels = available.filter((m) => requested.includes(m.id))
  const resolutionPlan = requestedModels.map((m) => {
    const closest = pickClosestResolution(m.supportedParams.resolutions, target)
    const effective = closest ?? target
    return {
      modelId: m.id,
      requested: target,
      effective,
      downgraded: closest !== null && !resolutionsEqual(effective, target),
    }
  })

  const config: TournamentConfig = {
    modelIds: requested,
    maxRounds: parsed.data.maxRounds ?? DEFAULTS.maxRounds,
    threshold: parsed.data.threshold ?? DEFAULTS.threshold,
    topN: parsed.data.topN ?? DEFAULTS.topN,
    timeoutPerModelMs: parsed.data.timeoutPerModelMs ?? DEFAULTS.timeoutPerModelMs,
    width: targetWidth,
    height: targetHeight,
  }

  let judgeCostUsd = 0
  const judge = createImageJudge(gateway, {
    onCost: (e) => {
      judgeCostUsd += e.costUsd
    },
  })
  const validators = createImageValidators()

  const sse = createSSEStream()

  let cancelled = false
  const signal = request.signal
  if (signal) {
    if (signal.aborted) cancelled = true
    else signal.addEventListener('abort', () => {
      cancelled = true
      sse.close()
    })
  }

  sse.send('session', { prompt: parsed.data.prompt, config, resolutionPlan })

  ;(async () => {
    try {
      const runner = createTournamentRunner(gateway, judge, validators, imageRubric, {
        getJudgeCostUsd: () => judgeCostUsd,
      })
      const gen = runner(parsed.data.prompt, config)

      let finalResult: TournamentResult | undefined
      while (true) {
        if (cancelled) break
        const { value, done } = await gen.next()
        if (done) {
          finalResult = value
          break
        }
        sse.send('tournament', enrichEvent(value))
      }

      if (cancelled) return

      if (finalResult) {
        sse.send('result', enrichResult(finalResult))
      }
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
