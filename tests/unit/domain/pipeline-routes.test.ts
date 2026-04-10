// Pipeline Route Integration Tests — LE-8
// Tests all 4 route handlers with mocked DB and persistence.
// No real DB or LLM calls — fully isolated unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock @/lib/db at top level ──────────────────────────────────────────────

vi.mock('@/lib/db', () => {
  const mockDb = {
    projectBlueprint: {
      findUnique: vi.fn(),
    },
    stageSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
  return { db: mockDb }
})

import { db } from '@/lib/db'

const mockDb = db as unknown as {
  projectBlueprint: { findUnique: ReturnType<typeof vi.fn> }
  stageSession: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}

// ─── Import route handlers ────────────────────────────────────────────────────

import { POST as startPost } from '../../../src/app/api/blueprints/[blueprintId]/pipeline/start/route'
import { POST as runPost } from '../../../src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run/route'
import { POST as reviewPost } from '../../../src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review/route'
import { GET as stateGet } from '../../../src/app/api/blueprints/[blueprintId]/pipeline/state/route'

// ─── Import helpers ───────────────────────────────────────────────────────────

import { createElearnIdeationPipeline } from '../../../src/lib/domain/workflows/ideation/pipeline-config'
import type { IdeationPipeline } from '../../../src/lib/domain/workflows/pipeline-orchestrator'

// ─── Request helpers ──────────────────────────────────────────────────────────

function makeRequest(body?: unknown): Request {
  if (body !== undefined) {
    return new Request('http://localhost:3000/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request('http://localhost:3000/test', { method: 'POST' })
}

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/test', { method: 'GET' })
}

// Helper to build resolved params (routes use Promise<{ ... }>)
function params<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) }
}

// ─── Serialised pipeline helper ───────────────────────────────────────────────

function serialisedPipeline(blueprintId = 'bp1'): string {
  return JSON.stringify(createElearnIdeationPipeline(blueprintId))
}

function pipelineWithAwaitingReview(stageId: string, blueprintId = 'bp1'): IdeationPipeline {
  const pipeline = createElearnIdeationPipeline(blueprintId)
  pipeline.stageStates[stageId] = {
    ...pipeline.stageStates[stageId],
    status: 'awaiting_review',
    loopCount: 2,
    currentArtifact: { mock: true },
    bestArtifact: { mock: true },
    bestGrade: {
      overallScore: 80,
      passesThreshold: true,
      dimensionScores: [],
      recommendation: 'Approve',
      improvementPriorities: [],
    },
  }
  return pipeline
}

// ─────────────────────────────────────────────────────────────────────────────
// beforeEach: clear all mocks between tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /pipeline/start
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /pipeline/start', () => {
  it('returns 404 when blueprint not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)

    const res = await startPost(makeRequest(), params({ blueprintId: 'nonexistent' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/blueprint not found/i)
  })

  it('returns 409 when pipeline already exists', async () => {
    // Route calls findUnique, then loadPipelineState calls findUnique + findFirst
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    // loadPipelineState's findFirst returns an existing sentinel
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss-existing',
      metadata: serialisedPipeline(),
    })

    const res = await startPost(makeRequest(), params({ blueprintId: 'bp1' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/already exists/i)
  })

  it('returns 200 with pipeline info on success (5 stages, brief as current)', async () => {
    // Route: findUnique (blueprint validation)
    // loadPipelineState: findUnique (getProjectId) + findFirst (no sentinel) → returns null
    // savePipelineState: findUnique (getProjectId) + findFirst (no sentinel) → create
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst
      .mockResolvedValueOnce(null)  // loadPipelineState: no existing pipeline
      .mockResolvedValueOnce(null)  // savePipelineState: no existing sentinel
    mockDb.stageSession.create.mockResolvedValue({ id: 'ss-new' })

    const res = await startPost(makeRequest(), params({ blueprintId: 'bp1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalStages).toBe(5)
    expect(body.currentStage.id).toBe('brief')
    expect(body.status).toBe('active')
    expect(body.pipelineId).toMatch(/elearn-ideation-bp1/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /pipeline/stages/[stageId]/run
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /pipeline/stages/[stageId]/run', () => {
  it('returns 404 when pipeline not found', async () => {
    // loadPipelineState: findUnique (projectId) + findFirst (no sentinel)
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)

    const res = await runPost(
      makeRequest({}),
      params({ blueprintId: 'bp1', stageId: 'brief' })
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/pipeline not found/i)
  })

  it('returns 400 when stageId is not the current stage', async () => {
    // Current stage is 'brief' (index 0), but we're requesting 'audience'
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialisedPipeline(),
    })

    const res = await runPost(
      makeRequest({}),
      params({ blueprintId: 'bp1', stageId: 'audience' })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not the current stage/i)
  })

  it('returns 200 with stage state on successful run', async () => {
    // loadPipelineState: findUnique + findFirst (returns pipeline)
    // savePipelineState after runCurrentStage: findUnique + findFirst (no sentinel) + create
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst
      .mockResolvedValueOnce({ id: 'ss1', metadata: serialisedPipeline() })  // load
      .mockResolvedValueOnce(null)  // save: no existing sentinel
    mockDb.stageSession.create.mockResolvedValue({ id: 'ss-new' })

    const res = await runPost(
      makeRequest({}),
      params({ blueprintId: 'bp1', stageId: 'brief' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stageId).toBe('brief')
    // After first iteration (score=65 < threshold), state is 'revising' or 'awaiting_review'
    // (mock judge: call 1 → 65, call 2 → 80; minIterations=2 so it runs 2 loops)
    expect(['revising', 'awaiting_review', 'generating', 'evaluating']).toContain(body.status)
    expect(body.loopCount).toBeGreaterThanOrEqual(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /pipeline/stages/[stageId]/review
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /pipeline/stages/[stageId]/review', () => {
  it('returns 400 with invalid action value (Zod rejects it)', async () => {
    const res = await reviewPost(
      makeRequest({ action: 'invalid_action' }),
      params({ blueprintId: 'bp1', stageId: 'brief' })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 400 when stage is not awaiting_review', async () => {
    // Pipeline with brief in 'idle' state (default from createElearnIdeationPipeline)
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialisedPipeline(),  // brief is 'idle', not awaiting_review
    })

    const res = await reviewPost(
      makeRequest({ action: 'approve' }),
      params({ blueprintId: 'bp1', stageId: 'brief' })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not 'awaiting_review'/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /pipeline/state
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /pipeline/state', () => {
  it('returns 404 when pipeline not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)

    const res = await stateGet(makeGetRequest(), params({ blueprintId: 'bp1' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/pipeline not found/i)
  })

  it('returns 200 with full pipeline state', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialisedPipeline(),
    })

    const res = await stateGet(makeGetRequest(), params({ blueprintId: 'bp1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.pipelineId).toMatch(/elearn-ideation-bp1/)
    expect(body.status).toBe('active')
    expect(body.stages).toHaveLength(5)
    expect(body.stages.map((s: { id: string }) => s.id)).toEqual([
      'brief', 'audience', 'structure', 'components', 'handoff',
    ])
    expect(body.progress).toBeDefined()
    expect(body.progress.total).toBe(5)
    expect(body.currentStage).not.toBeNull()
    expect(body.currentStage.id).toBe('brief')
  })
})
