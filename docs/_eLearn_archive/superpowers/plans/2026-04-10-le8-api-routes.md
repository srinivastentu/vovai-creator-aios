# LE-8: Pipeline API Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create four curl-able API endpoints that drive the ideation pipeline — start, run stage, review stage, and get state — alongside existing ideation routes without modifying them.

**Architecture:** New routes in `src/app/api/blueprints/[blueprintId]/pipeline/` call domain-layer orchestrator functions with mock agent executor and judge. Pipeline state persists to the existing `StageSession` model using `stageId: 0` as a pipeline-level sentinel, storing the full `IdeationPipeline` object as JSON in the `metadata` field. No Prisma migrations required.

**Tech Stack:** Next.js 15 App Router, Zod v4 validation, Prisma (existing schema), Vitest

**Key design decisions:**
- `presenting` → `awaiting_review` transition happens immediately in the `/run` route (Option A). Clients never see `presenting`.
- Mock judge uses per-stage call counters (closure resets per stage). First call: score 65. Second call: score 80.
- Date reconstruction in `loadPipelineState`: `createdAt` and `updatedAt` are restored as `new Date(value)` after JSON parse.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/validations/pipeline.ts` | Create | Zod schemas for pipeline routes |
| `src/lib/domain/workflows/pipeline-mocks.ts` | Create | Mock agent executor and mock judge for LE-8 |
| `src/lib/domain/workflows/pipeline-persistence.ts` | Create | Save/load pipeline state to/from StageSession |
| `src/app/api/blueprints/[blueprintId]/pipeline/start/route.ts` | Create | POST — create pipeline |
| `src/app/api/blueprints/[blueprintId]/pipeline/state/route.ts` | Create | GET — full pipeline state |
| `src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run/route.ts` | Create | POST — run one loop iteration |
| `src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review/route.ts` | Create | POST — submit human review |
| `tests/unit/domain/pipeline-mocks.test.ts` | Create | Tests for mock executor and judge |
| `tests/unit/domain/pipeline-persistence.test.ts` | Create | Tests for state persistence helpers |
| `tests/unit/domain/pipeline-routes.test.ts` | Create | Tests for all 4 route handlers |

**No existing files are modified.**

---

## Task 1: Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/pipeline.ts`

- [ ] **Step 1: Create the validation schemas file**

```typescript
// src/lib/validations/pipeline.ts
import { z } from 'zod/v4'

// POST /api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run
export const runStageSchema = z.object({
  context: z.record(z.string(), z.unknown()).optional(),
})

export type RunStageInput = z.infer<typeof runStageSchema>

// POST /api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review
export const reviewStageSchema = z.object({
  action: z.enum(['approve', 'reject', 'feedback', 'use_segments', 'mix_produce']),
  message: z.string().max(5000, 'Message cannot exceed 5,000 characters').optional(),
  editedArtifact: z.unknown().optional(),
})

export type ReviewStageInput = z.infer<typeof reviewStageSchema>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/pipeline.ts
git commit -m "feat(api): LE-8 Zod schemas for pipeline routes"
```

---

## Task 2: Mock Agent Executor and Mock Judge

**Files:**
- Create: `src/lib/domain/workflows/pipeline-mocks.ts`
- Create: `tests/unit/domain/pipeline-mocks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/domain/pipeline-mocks.test.ts
import { describe, it, expect } from 'vitest'
import {
  createMockAgentExecutor,
  createMockJudge,
} from '../../../src/lib/domain/workflows/pipeline-mocks'
import type { AgentConfig, RubricDefinition, LoopState } from '../../../src/lib/core/engine/types'

const dummyAgents: AgentConfig[] = [{
  id: 'a1', name: 'Agent', model: { primary: 'claude', fallback: 'gpt' },
  maxRetries: 2, timeoutMs: 5000,
}]

const dummyRubric: RubricDefinition = {
  id: 'r1', name: 'Test Rubric', passThreshold: 75,
  dimensions: [
    { id: 'd1', name: 'Quality', weight: 0.5, passThreshold: 70, description: 'Quality', criteria: {} },
    { id: 'd2', name: 'Clarity', weight: 0.5, passThreshold: 70, description: 'Clarity', criteria: {} },
  ],
}

function makeState(stageId: string): LoopState<unknown> {
  return {
    stageId, status: 'generating', currentArtifact: null, bestArtifact: null,
    bestGrade: null, iterations: [], loopCount: 0, humanFeedback: [], costUSD: 0,
  }
}

describe('createMockAgentExecutor', () => {
  it('returns artifact with correct shape for brief stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('brief'))
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('goals')
    expect(result).toHaveProperty('constraints')
    expect(result).toHaveProperty('audience_hint')
  })

  it('returns artifact with correct shape for audience stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('audience'))
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('experience_level')
    expect(result).toHaveProperty('modality_prefs')
  })

  it('returns artifact with correct shape for structure stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('structure'))
    expect(result).toHaveProperty('modules')
    expect(result).toHaveProperty('topic_count')
    expect(result).toHaveProperty('outcome_count')
  })

  it('returns artifact with correct shape for components stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('components'))
    expect(result).toHaveProperty('assignments')
    expect(result).toHaveProperty('total_components')
  })

  it('returns artifact with correct shape for handoff stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('handoff'))
    expect(result).toHaveProperty('ready')
    expect(result).toHaveProperty('cost_estimate')
    expect(result).toHaveProperty('timeline')
  })

  it('returns fallback artifact for unknown stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('unknown'))
    expect(result).toHaveProperty('mock')
  })
})

describe('createMockJudge', () => {
  it('returns score 65 on first call for a stage', async () => {
    const judge = createMockJudge()
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.overallScore).toBe(65)
    expect(grade.passesThreshold).toBe(false)
  })

  it('returns score 80 on second call for same stage', async () => {
    const judge = createMockJudge()
    await judge({ content: 'test' }, dummyRubric)
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.overallScore).toBe(80)
    expect(grade.passesThreshold).toBe(true)
  })

  it('resets counter per rubric (separate stages get independent counters)', async () => {
    const judge = createMockJudge()

    // Call with rubric "r1" twice
    await judge({ content: 'test' }, dummyRubric)
    await judge({ content: 'test' }, dummyRubric)

    // Call with a different rubric — should get 65 (first call for this rubric)
    const otherRubric: RubricDefinition = { ...dummyRubric, id: 'r2', name: 'Other' }
    const grade = await judge({ content: 'test' }, otherRubric)
    expect(grade.overallScore).toBe(65)
  })

  it('returns dimension scores matching rubric dimensions', async () => {
    const judge = createMockJudge()
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.dimensionScores).toHaveLength(2)
    expect(grade.dimensionScores[0].dimensionId).toBe('d1')
    expect(grade.dimensionScores[1].dimensionId).toBe('d2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/domain/pipeline-mocks.test.ts 2>&1 | tail -5`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/domain/workflows/pipeline-mocks.ts
// Mock agent executor and judge for LE-8 API routes.
// Returns plausible artifacts per stage and simulates scoring progression.
// Real agents replace these in LE-10.

import type {
  AgentExecutor,
  JudgeFunction,
  GradeReport,
  RubricDefinition,
} from '../../core/engine/types'

const MOCK_ARTIFACTS: Record<string, unknown> = {
  brief: {
    title: 'Mock Course: Introduction to AI',
    goals: ['Understand ML fundamentals', 'Build a simple model'],
    constraints: ['8 hours total', 'No prerequisites beyond basic math'],
    audience_hint: 'Working professionals transitioning to AI roles',
  },
  audience: {
    description: 'Working professionals with 2-5 years experience',
    experience_level: 'intermediate',
    modality_prefs: ['video', 'quiz', 'hands-on-activity'],
  },
  structure: {
    modules: [
      { title: 'Module 1: Foundations', topics: ['What is AI?', 'History of ML'] },
      { title: 'Module 2: Core Concepts', topics: ['Supervised Learning', 'Neural Networks'] },
      { title: 'Module 3: Practical Applications', topics: ['Model Training', 'Deployment'] },
    ],
    topic_count: 6,
    outcome_count: 12,
  },
  components: {
    assignments: [
      { nodeId: 'n1', type: 'video', title: 'Introduction Video' },
      { nodeId: 'n2', type: 'quiz', title: 'Foundations Quiz' },
      { nodeId: 'n3', type: 'activity', title: 'Build a Classifier' },
    ],
    total_components: 18,
  },
  handoff: {
    ready: true,
    cost_estimate: '$45.00',
    timeline: '2 weeks',
  },
}

export function createMockAgentExecutor(): AgentExecutor {
  return async (_agents, _context, state) => {
    return MOCK_ARTIFACTS[state.stageId] ?? { mock: true, stageId: state.stageId }
  }
}

function buildGradeReport(
  score: number,
  rubric: RubricDefinition
): GradeReport {
  const passes = score >= rubric.passThreshold
  return {
    overallScore: score,
    passesThreshold: passes,
    dimensionScores: rubric.dimensions.map((dim) => ({
      dimensionId: dim.id,
      name: dim.name,
      score,
      weight: dim.weight,
      feedback: passes
        ? `${dim.name} meets expectations`
        : `${dim.name} needs improvement`,
    })),
    recommendation: passes ? 'Present to reviewer' : 'Revise and resubmit',
    improvementPriorities: passes ? [] : rubric.dimensions.map((d) => d.name),
  }
}

export function createMockJudge(): JudgeFunction {
  const callCounts = new Map<string, number>()

  return async (_artifact, rubric) => {
    const key = rubric.id
    const count = (callCounts.get(key) ?? 0) + 1
    callCounts.set(key, count)

    const score = count === 1 ? 65 : 80
    return buildGradeReport(score, rubric)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/pipeline-mocks.test.ts 2>&1 | tail -10`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/workflows/pipeline-mocks.ts tests/unit/domain/pipeline-mocks.test.ts
git commit -m "feat(domain): LE-8 mock agent executor and judge with per-stage counters"
```

---

## Task 3: Pipeline State Persistence

**Files:**
- Create: `src/lib/domain/workflows/pipeline-persistence.ts`
- Create: `tests/unit/domain/pipeline-persistence.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/domain/pipeline-persistence.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  savePipelineState,
  loadPipelineState,
  deletePipelineState,
  PIPELINE_SENTINEL_STAGE_ID,
} from '../../../src/lib/domain/workflows/pipeline-persistence'
import type { IdeationPipeline } from '../../../src/lib/domain/workflows/pipeline-orchestrator'

// Mock Prisma
vi.mock('@/lib/db', () => {
  const mockDb = {
    projectBlueprint: {
      findUnique: vi.fn(),
    },
    stageSession: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
  return { db: mockDb }
})

import { db } from '@/lib/db'

const mockDb = db as unknown as {
  projectBlueprint: {
    findUnique: ReturnType<typeof vi.fn>
  }
  stageSession: {
    findFirst: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}

function makePipeline(): IdeationPipeline {
  return {
    id: 'elearn-ideation-bp1',
    blueprintId: 'bp1',
    stages: [],
    currentStageIndex: 0,
    stageStates: {},
    status: 'active',
    createdAt: new Date('2026-04-10T12:00:00Z'),
    updatedAt: new Date('2026-04-10T12:00:00Z'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PIPELINE_SENTINEL_STAGE_ID', () => {
  it('is 0', () => {
    expect(PIPELINE_SENTINEL_STAGE_ID).toBe(0)
  })
})

describe('savePipelineState', () => {
  it('upserts a StageSession with stageId 0 and pipeline JSON in metadata', async () => {
    const pipeline = makePipeline()
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.upsert.mockResolvedValue({ id: 'ss1' })

    await savePipelineState('bp1', pipeline)

    expect(mockDb.projectBlueprint.findUnique).toHaveBeenCalledWith({
      where: { id: 'bp1' },
      select: { projectId: true },
    })
    expect(mockDb.stageSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId_stageId: { projectId: 'proj1', stageId: 0 },
        }),
        create: expect.objectContaining({
          projectId: 'proj1',
          stageId: 0,
          metadata: expect.any(String),
        }),
        update: expect.objectContaining({
          metadata: expect.any(String),
        }),
      })
    )
  })

  it('throws if blueprint not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)
    await expect(savePipelineState('nonexistent', makePipeline())).rejects.toThrow('Blueprint not found')
  })
})

describe('loadPipelineState', () => {
  it('returns null when no sentinel session exists', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)
    const result = await loadPipelineState('bp1')
    expect(result).toBeNull()
  })

  it('returns deserialized pipeline when sentinel session exists', async () => {
    const pipeline = makePipeline()
    const serialized = JSON.stringify(pipeline)

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialized,
    })

    const result = await loadPipelineState('bp1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('elearn-ideation-bp1')
    expect(result!.blueprintId).toBe('bp1')
    expect(result!.status).toBe('active')
  })

  it('reconstructs Date objects from JSON strings', async () => {
    const pipeline = makePipeline()
    const serialized = JSON.stringify(pipeline)

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialized,
    })

    const result = await loadPipelineState('bp1')
    expect(result!.createdAt).toBeInstanceOf(Date)
    expect(result!.updatedAt).toBeInstanceOf(Date)
    expect(result!.createdAt.toISOString()).toBe('2026-04-10T12:00:00.000Z')
  })

  it('handles metadata that is already parsed as object (Prisma Json field)', async () => {
    const pipeline = makePipeline()

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.parse(JSON.stringify(pipeline)),
    })

    const result = await loadPipelineState('bp1')
    expect(result).not.toBeNull()
    expect(result!.createdAt).toBeInstanceOf(Date)
  })
})

describe('deletePipelineState', () => {
  it('deletes sentinel session for the project', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.deleteMany.mockResolvedValue({ count: 1 })

    await deletePipelineState('bp1')

    expect(mockDb.stageSession.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'proj1', stageId: 0 },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/domain/pipeline-persistence.test.ts 2>&1 | tail -5`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Note: The `StageSession` model has a `@@unique` constraint issue — there is no `@@unique([projectId, stageId])` in the schema. The `upsert` needs a unique constraint. Since we cannot add migrations, we'll use `findFirst` + `create`/`update` pattern instead.

```typescript
// src/lib/domain/workflows/pipeline-persistence.ts
// Persists IdeationPipeline state to StageSession with stageId=0 sentinel.
// No Prisma migrations — uses existing schema as-is.

import { db } from '@/lib/db'
import type { IdeationPipeline } from './pipeline-orchestrator'

export const PIPELINE_SENTINEL_STAGE_ID = 0

async function getProjectId(blueprintId: string): Promise<string> {
  const blueprint = await db.projectBlueprint.findUnique({
    where: { id: blueprintId },
    select: { projectId: true },
  })
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${blueprintId}`)
  }
  return blueprint.projectId
}

function serializePipeline(pipeline: IdeationPipeline): string {
  return JSON.stringify(pipeline)
}

function deserializePipeline(data: unknown): IdeationPipeline {
  const raw = typeof data === 'string' ? JSON.parse(data) : data
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  } as IdeationPipeline
}

export async function savePipelineState(
  blueprintId: string,
  pipeline: IdeationPipeline
): Promise<void> {
  const projectId = await getProjectId(blueprintId)
  const serialized = serializePipeline(pipeline)

  const existing = await db.stageSession.findFirst({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
    select: { id: true },
  })

  if (existing) {
    await db.stageSession.update({
      where: { id: existing.id },
      data: { metadata: serialized, updatedAt: new Date() },
    })
  } else {
    await db.stageSession.create({
      data: {
        projectId,
        stageId: PIPELINE_SENTINEL_STAGE_ID,
        metadata: serialized,
        status: 'idle',
      },
    })
  }
}

export async function loadPipelineState(
  blueprintId: string
): Promise<IdeationPipeline | null> {
  const projectId = await getProjectId(blueprintId)

  const session = await db.stageSession.findFirst({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
    select: { metadata: true },
  })

  if (!session?.metadata) return null
  return deserializePipeline(session.metadata)
}

export async function deletePipelineState(
  blueprintId: string
): Promise<void> {
  const projectId = await getProjectId(blueprintId)
  await db.stageSession.deleteMany({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
  })
}
```

- [ ] **Step 4: Update tests to match findFirst+create/update pattern instead of upsert**

The `savePipelineState` tests need adjustment since we're using `findFirst` + `create`/`update` instead of `upsert`. Update the mock setup and assertions:

Replace the `savePipelineState` describe block in the test file:

```typescript
describe('savePipelineState', () => {
  it('creates a new StageSession when none exists', async () => {
    const pipeline = makePipeline()
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)
    mockDb.stageSession.create.mockResolvedValue({ id: 'ss1' })

    await savePipelineState('bp1', pipeline)

    expect(mockDb.stageSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj1',
          stageId: 0,
          metadata: expect.any(String),
          status: 'idle',
        }),
      })
    )
  })

  it('updates existing StageSession when one exists', async () => {
    const pipeline = makePipeline()
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({ id: 'ss-existing' })
    mockDb.stageSession.update.mockResolvedValue({ id: 'ss-existing' })

    await savePipelineState('bp1', pipeline)

    expect(mockDb.stageSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ss-existing' },
        data: expect.objectContaining({
          metadata: expect.any(String),
        }),
      })
    )
  })

  it('throws if blueprint not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)
    await expect(savePipelineState('nonexistent', makePipeline())).rejects.toThrow('Blueprint not found')
  })
})
```

Also add `create` and `update` to the mock:

```typescript
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

// Update the mockDb type:
const mockDb = db as unknown as {
  projectBlueprint: {
    findUnique: ReturnType<typeof vi.fn>
  }
  stageSession: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/pipeline-persistence.test.ts 2>&1 | tail -10`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/workflows/pipeline-persistence.ts tests/unit/domain/pipeline-persistence.test.ts
git commit -m "feat(domain): LE-8 pipeline state persistence via StageSession sentinel"
```

---

## Task 4: Route 1 — POST /pipeline/start

**Files:**
- Create: `src/app/api/blueprints/[blueprintId]/pipeline/start/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/blueprints/[blueprintId]/pipeline/start/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createElearnIdeationPipeline } from '@/lib/domain/workflows/ideation/pipeline-config'
import { savePipelineState, loadPipelineState } from '@/lib/domain/workflows/pipeline-persistence'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // 1. Validate blueprint exists
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // 2. Check if pipeline already exists (409 Conflict)
    const existing = await loadPipelineState(blueprintId)
    if (existing) {
      return NextResponse.json(
        { error: 'Pipeline already exists for this blueprint' },
        { status: 409 }
      )
    }

    // 3. Create pipeline
    const pipeline = createElearnIdeationPipeline(blueprintId)

    // 4. Persist
    await savePipelineState(blueprintId, pipeline)

    // 5. Return summary
    const currentStage = pipeline.stages[pipeline.currentStageIndex]
    return NextResponse.json({
      pipelineId: pipeline.id,
      currentStage: { id: currentStage.id, name: currentStage.id },
      totalStages: pipeline.stages.length,
      status: pipeline.status,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/pipeline/start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/blueprints/\[blueprintId\]/pipeline/start/route.ts
git commit -m "feat(api): LE-8 POST /pipeline/start route"
```

---

## Task 5: Route 2 — POST /pipeline/stages/[stageId]/run

**Files:**
- Create: `src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run/route.ts
import { NextResponse } from 'next/server'
import { runStageSchema } from '@/lib/validations/pipeline'
import { formatZodError } from '@/lib/validations/blueprint'
import { loadPipelineState, savePipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import { getCurrentStage, runCurrentStage } from '@/lib/domain/workflows/pipeline-orchestrator'
import { createMockAgentExecutor, createMockJudge } from '@/lib/domain/workflows/pipeline-mocks'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string; stageId: string }> }
) {
  try {
    const { blueprintId, stageId } = await params

    // 1. Parse and validate body
    let body: unknown = {}
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      body = await request.json()
    }
    const parsed = runStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // 2. Load pipeline
    const pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 3. Verify stageId matches current stage
    const currentStage = getCurrentStage(pipeline)
    if (!currentStage) {
      return NextResponse.json({ error: 'Pipeline is complete' }, { status: 400 })
    }
    if (currentStage.id !== stageId) {
      return NextResponse.json(
        { error: `Stage '${stageId}' is not the current stage. Current: '${currentStage.id}'` },
        { status: 400 }
      )
    }

    // 4. Check if already approved
    const stageState = pipeline.stageStates[stageId]
    if (stageState?.status === 'approved') {
      return NextResponse.json(
        { error: `Stage '${stageId}' is already approved` },
        { status: 409 }
      )
    }

    // 5. Run one iteration with mocks
    const agentExecutor = createMockAgentExecutor()
    const judge = createMockJudge()
    const context = parsed.data.context ?? {}

    const { pipeline: updated, stageState: newState, gate } =
      await runCurrentStage(pipeline, context, agentExecutor, judge)

    // 6. Translate presenting → awaiting_review (Option A)
    let finalState = newState
    if (newState.status === 'presenting') {
      finalState = { ...newState, status: 'awaiting_review' as const }
      updated.stageStates[stageId] = finalState
    }

    // 7. Persist
    await savePipelineState(blueprintId, updated)

    // 8. Return stage state
    return NextResponse.json({
      stageId,
      status: finalState.status,
      loopCount: finalState.loopCount,
      grade: finalState.bestGrade,
      bestScore: finalState.bestGrade?.overallScore ?? null,
      gate: gate ?? null,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /pipeline/stages/[stageId]/run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/blueprints/\[blueprintId\]/pipeline/stages/\[stageId\]/run/route.ts
git commit -m "feat(api): LE-8 POST /pipeline/stages/[stageId]/run route"
```

---

## Task 6: Route 3 — POST /pipeline/stages/[stageId]/review

**Files:**
- Create: `src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review/route.ts
import { NextResponse } from 'next/server'
import { reviewStageSchema } from '@/lib/validations/pipeline'
import { formatZodError } from '@/lib/validations/blueprint'
import { loadPipelineState, savePipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import {
  getCurrentStage,
  canAdvance,
  advancePipeline,
  getCurrentState,
} from '@/lib/domain/workflows/pipeline-orchestrator'
import { processReview } from '@/lib/core/engine'
import { validateReviewAction, createGate } from '@/lib/core/review'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string; stageId: string }> }
) {
  try {
    const { blueprintId, stageId } = await params

    // 1. Parse and validate body
    const body = await request.json()
    const parsed = reviewStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // 2. Load pipeline
    let pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 3. Verify stage exists in pipeline
    const stageConfig = pipeline.stages.find((s) => s.id === stageId)
    if (!stageConfig) {
      return NextResponse.json({ error: `Stage '${stageId}' not found` }, { status: 404 })
    }

    // 4. Get stage state and verify it's awaiting review
    const stageState = pipeline.stageStates[stageId]
    if (!stageState) {
      return NextResponse.json({ error: `No state for stage '${stageId}'` }, { status: 404 })
    }
    if (stageState.status !== 'awaiting_review') {
      return NextResponse.json(
        { error: `Stage '${stageId}' is in '${stageState.status}' state, not 'awaiting_review'` },
        { status: 400 }
      )
    }

    // 5. Build gate and validate action
    const gate = createGate({
      stageId,
      artifactType: stageId,
      allowedActions: stageConfig.reviewGateConfig?.allowedActions,
      requiresRole: stageConfig.reviewerRoles,
    })

    const reviewAction = {
      type: parsed.data.action,
      message: parsed.data.message,
      editedArtifact: parsed.data.editedArtifact,
    }

    const validation = validateReviewAction(reviewAction, stageState, gate)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid review action',
          details: validation.errors.map((e) => e.message),
        },
        { status: 400 }
      )
    }

    // 6. Process review through core engine
    const newState = processReview(stageState, reviewAction)

    // 7. Update pipeline state
    pipeline = {
      ...pipeline,
      stageStates: {
        ...pipeline.stageStates,
        [stageId]: newState,
      },
      updatedAt: new Date(),
    }

    // 8. If approved and can advance, advance pipeline
    let pipelineAdvanced = false
    let nextStage: { id: string } | null = null

    if (newState.status === 'approved' && canAdvance(pipeline)) {
      pipeline = advancePipeline(pipeline)
      pipelineAdvanced = true
      const next = getCurrentStage(pipeline)
      nextStage = next ? { id: next.id } : null
    }

    // 9. Persist
    await savePipelineState(blueprintId, pipeline)

    // 10. Return result
    return NextResponse.json({
      stageId,
      status: newState.status,
      pipelineAdvanced,
      nextStage,
      pipelineStatus: pipeline.status,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /pipeline/stages/[stageId]/review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/blueprints/\[blueprintId\]/pipeline/stages/\[stageId\]/review/route.ts
git commit -m "feat(api): LE-8 POST /pipeline/stages/[stageId]/review route"
```

---

## Task 7: Route 4 — GET /pipeline/state

**Files:**
- Create: `src/app/api/blueprints/[blueprintId]/pipeline/state/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/blueprints/[blueprintId]/pipeline/state/route.ts
import { NextResponse } from 'next/server'
import { loadPipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import {
  getCurrentStage,
  getPipelineProgress,
} from '@/lib/domain/workflows/pipeline-orchestrator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // 1. Load pipeline
    const pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 2. Get progress
    const progress = getPipelineProgress(pipeline)
    const currentStage = getCurrentStage(pipeline)

    // 3. Build stage summaries
    const stages = pipeline.stages.map((stage) => {
      const state = pipeline.stageStates[stage.id]
      return {
        id: stage.id,
        status: state?.status ?? 'idle',
        loopCount: state?.loopCount ?? 0,
        bestScore: state?.bestGrade?.overallScore ?? null,
      }
    })

    // 4. Build current stage summary
    const currentStageSummary = currentStage
      ? {
          id: currentStage.id,
          status: pipeline.stageStates[currentStage.id]?.status ?? 'idle',
          loopCount: pipeline.stageStates[currentStage.id]?.loopCount ?? 0,
          bestScore: pipeline.stageStates[currentStage.id]?.bestGrade?.overallScore ?? null,
        }
      : null

    return NextResponse.json({
      pipelineId: pipeline.id,
      status: pipeline.status,
      progress,
      currentStage: currentStageSummary,
      stages,
    }, { status: 200 })
  } catch (error) {
    console.error('GET /pipeline/state error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/blueprints/\[blueprintId\]/pipeline/state/route.ts
git commit -m "feat(api): LE-8 GET /pipeline/state route"
```

---

## Task 8: Route Integration Tests

**Files:**
- Create: `tests/unit/domain/pipeline-routes.test.ts`

- [ ] **Step 1: Write tests for all 4 routes**

These tests call the exported route handler functions directly with mock Request objects and mocked DB.

```typescript
// tests/unit/domain/pipeline-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db before any route imports
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
import { POST as startRoute } from '../../../../src/app/api/blueprints/[blueprintId]/pipeline/start/route'
import { POST as runRoute } from '../../../../src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/run/route'
import { POST as reviewRoute } from '../../../../src/app/api/blueprints/[blueprintId]/pipeline/stages/[stageId]/review/route'
import { GET as stateRoute } from '../../../../src/app/api/blueprints/[blueprintId]/pipeline/state/route'

const mockDb = db as unknown as {
  projectBlueprint: { findUnique: ReturnType<typeof vi.fn> }
  stageSession: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}

function makeRequest(body?: unknown, method = 'POST'): Request {
  if (body !== undefined) {
    return new Request('http://localhost:3000/test', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request('http://localhost:3000/test', { method })
}

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/test', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /pipeline/start
// ---------------------------------------------------------------------------

describe('POST /pipeline/start', () => {
  it('returns 404 when blueprint not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)
    const res = await startRoute(makeRequest(), {
      params: Promise.resolve({ blueprintId: 'nonexistent' }),
    })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('Blueprint not found')
  })

  it('returns 409 when pipeline already exists', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    // loadPipelineState finds existing sentinel
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.stringify({
        id: 'p1', blueprintId: 'bp1', stages: [], currentStageIndex: 0,
        stageStates: {}, status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }),
    })
    const res = await startRoute(makeRequest(), {
      params: Promise.resolve({ blueprintId: 'bp1' }),
    })
    expect(res.status).toBe(409)
  })

  it('returns 200 with pipeline info on success', async () => {
    // First call: findUnique for blueprint (start route)
    // Second call: findUnique for blueprint (loadPipelineState)
    // Third call: findUnique for blueprint (savePipelineState)
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    // First findFirst: loadPipelineState returns null (no existing pipeline)
    // Second findFirst: savePipelineState checks for existing sentinel
    mockDb.stageSession.findFirst
      .mockResolvedValueOnce(null)  // loadPipelineState
      .mockResolvedValueOnce(null)  // savePipelineState
    mockDb.stageSession.create.mockResolvedValue({ id: 'ss-new' })

    const res = await startRoute(makeRequest(), {
      params: Promise.resolve({ blueprintId: 'bp1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.pipelineId).toContain('elearn-ideation-bp1')
    expect(data.currentStage.id).toBe('brief')
    expect(data.totalStages).toBe(5)
    expect(data.status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// POST /pipeline/stages/[stageId]/run
// ---------------------------------------------------------------------------

describe('POST /pipeline/stages/[stageId]/run', () => {
  function mockPipelineExists() {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
  }

  function mockPipelineLoaded(pipelineJson: string) {
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: pipelineJson,
    })
  }

  it('returns 404 when pipeline not found', async () => {
    mockPipelineExists()
    mockDb.stageSession.findFirst.mockResolvedValue(null)

    const res = await runRoute(makeRequest({}), {
      params: Promise.resolve({ blueprintId: 'bp1', stageId: 'brief' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when stageId is not the current stage', async () => {
    mockPipelineExists()
    // Create a real pipeline via the factory, serialize it
    const { createElearnIdeationPipeline } = await import(
      '../../../../src/lib/domain/workflows/ideation/pipeline-config'
    )
    const pipeline = createElearnIdeationPipeline('bp1')
    mockPipelineLoaded(JSON.stringify(pipeline))

    const res = await runRoute(makeRequest({}), {
      params: Promise.resolve({ blueprintId: 'bp1', stageId: 'audience' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not the current stage')
  })

  it('returns 200 with stage state on successful run', async () => {
    mockPipelineExists()
    const { createElearnIdeationPipeline } = await import(
      '../../../../src/lib/domain/workflows/ideation/pipeline-config'
    )
    const pipeline = createElearnIdeationPipeline('bp1')
    mockPipelineLoaded(JSON.stringify(pipeline))
    // savePipelineState will call findFirst then update/create
    mockDb.stageSession.findFirst
      .mockResolvedValueOnce({ id: 'ss1', metadata: JSON.stringify(pipeline) }) // load
      .mockResolvedValueOnce({ id: 'ss1' }) // save check
    mockDb.stageSession.update.mockResolvedValue({ id: 'ss1' })

    const res = await runRoute(makeRequest({}), {
      params: Promise.resolve({ blueprintId: 'bp1', stageId: 'brief' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stageId).toBe('brief')
    expect(data.loopCount).toBe(1)
    expect(typeof data.bestScore).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// POST /pipeline/stages/[stageId]/review
// ---------------------------------------------------------------------------

describe('POST /pipeline/stages/[stageId]/review', () => {
  it('returns 400 with invalid action value', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.stringify({
        id: 'p1', blueprintId: 'bp1', stages: [{ id: 'brief' }],
        currentStageIndex: 0,
        stageStates: { brief: { stageId: 'brief', status: 'awaiting_review' } },
        status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }),
    })

    const res = await reviewRoute(makeRequest({ action: 'invalid_action' }), {
      params: Promise.resolve({ blueprintId: 'bp1', stageId: 'brief' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when stage is not awaiting_review', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.stringify({
        id: 'p1', blueprintId: 'bp1',
        stages: [{ id: 'brief', reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] } }],
        currentStageIndex: 0,
        stageStates: { brief: { stageId: 'brief', status: 'generating', iterations: [], loopCount: 0, humanFeedback: [], costUSD: 0 } },
        status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }),
    })

    const res = await reviewRoute(makeRequest({ action: 'approve' }), {
      params: Promise.resolve({ blueprintId: 'bp1', stageId: 'brief' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('awaiting_review')
  })
})

// ---------------------------------------------------------------------------
// GET /pipeline/state
// ---------------------------------------------------------------------------

describe('GET /pipeline/state', () => {
  it('returns 404 when pipeline not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)

    const res = await stateRoute(makeGetRequest(), {
      params: Promise.resolve({ blueprintId: 'bp1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with full pipeline state', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    const { createElearnIdeationPipeline } = await import(
      '../../../../src/lib/domain/workflows/ideation/pipeline-config'
    )
    const pipeline = createElearnIdeationPipeline('bp1')
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.stringify(pipeline),
    })

    const res = await stateRoute(makeGetRequest(), {
      params: Promise.resolve({ blueprintId: 'bp1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.pipelineId).toContain('elearn-ideation-bp1')
    expect(data.status).toBe('active')
    expect(data.progress.total).toBe(5)
    expect(data.stages).toHaveLength(5)
    expect(data.currentStage.id).toBe('brief')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/pipeline-routes.test.ts 2>&1 | tail -15`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/domain/pipeline-routes.test.ts
git commit -m "test(api): LE-8 pipeline route integration tests"
```

---

## Task 9: Full Verification

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm run test 2>&1 | tail -20`
Expected: 529+ tests pass (all existing tests unchanged)

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Verify architectural contract**

Run: `grep -r "from.*domain/" src/lib/core/`
Expected: No output (nothing returned)

- [ ] **Step 5: Verify no existing routes were modified**

Run: `git diff HEAD -- src/app/api/blueprints/\[blueprintId\]/ideation/`
Expected: No output (no changes to existing ideation routes)

- [ ] **Step 6: Start dev server and test with curl**

Run: `npm run dev &` then:

```bash
# Start pipeline
curl -s -X POST http://localhost:3000/api/blueprints/{REAL_BLUEPRINT_ID}/pipeline/start | jq .

# Run first iteration (should get score 65, status revising)
curl -s -X POST http://localhost:3000/api/blueprints/{REAL_BLUEPRINT_ID}/pipeline/stages/brief/run \
  -H 'Content-Type: application/json' -d '{}' | jq .

# Run second iteration (should get score 80, status awaiting_review)
curl -s -X POST http://localhost:3000/api/blueprints/{REAL_BLUEPRINT_ID}/pipeline/stages/brief/run \
  -H 'Content-Type: application/json' -d '{}' | jq .

# Get state
curl -s http://localhost:3000/api/blueprints/{REAL_BLUEPRINT_ID}/pipeline/state | jq .

# Approve
curl -s -X POST http://localhost:3000/api/blueprints/{REAL_BLUEPRINT_ID}/pipeline/stages/brief/review \
  -H 'Content-Type: application/json' -d '{"action":"approve"}' | jq .
```

Replace `{REAL_BLUEPRINT_ID}` with an actual blueprint ID from the database. To find one:
```bash
npx prisma studio
# Or query: SELECT id FROM "ProjectBlueprint" LIMIT 1;
```

- [ ] **Step 7: Final commit with verification results**

```bash
git add -A
git commit -m "docs: LE-8 post-completion verification — all tests pass, routes curl-able"
```

- [ ] **Step 8: Tag**

```bash
git tag LE-8-api-routes
```
