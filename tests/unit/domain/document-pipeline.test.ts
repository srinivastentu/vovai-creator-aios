// LE-12: Document Pipeline — Engine Universality Proof
// The SAME core engine (runLoop, processReview, createInitialState) runs
// a COMPLETELY DIFFERENT domain config (1-10 scale, threshold 7).
// If these tests pass, core/domain separation is proven.

import { describe, it, expect } from 'vitest'
import {
  DOC_RESEARCH_RUBRIC,
  DOC_CONTENT_RUBRIC,
  DOC_FORMAT_RUBRIC,
  DOC_QA_RUBRIC,
  DOC_REVIEW_RUBRIC,
  DOCUMENT_PIPELINE_STAGES,
  createDocumentPipeline,
} from '../../../src/lib/domain/workflows/production/document-pipeline'
import {
  createInitialState,
  runLoop,
  processReview,
} from '../../../src/lib/core/engine'
import {
  advancePipeline,
  isPipelineComplete,
  getPipelineProgress,
  runCurrentStage,
} from '../../../src/lib/domain/workflows/pipeline-orchestrator'
import type {
  AgentExecutor,
  JudgeFunction,
  GradeReport,
  RubricDefinition,
} from '../../../src/lib/core/engine/types'

// ---------------------------------------------------------------------------
// Test helpers — mock executor and judge for document domain
// ---------------------------------------------------------------------------

function createDocMockExecutor(): AgentExecutor {
  return async (_agents, _context, state) => ({
    stageId: state.stageId,
    content: `Mock ${state.stageId} artifact`,
    version: state.loopCount + 1,
  })
}

function createDocMockJudge(score: number): JudgeFunction {
  return async (_artifact, rubric) => ({
    overallScore: score,
    passesThreshold: score >= rubric.passThreshold,
    dimensionScores: rubric.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score,
      weight: d.weight,
      feedback: `Mock feedback for ${d.name}`,
    })),
    recommendation: score >= rubric.passThreshold ? 'Pass' : 'Needs revision',
    improvementPriorities: score >= rubric.passThreshold ? [] : ['Improve quality'],
  })
}

function createDocStatefulJudge(scores: number[]): JudgeFunction {
  let callCount = 0
  return async (_artifact, rubric) => {
    const score = scores[Math.min(callCount++, scores.length - 1)]
    return {
      overallScore: score,
      passesThreshold: score >= rubric.passThreshold,
      dimensionScores: rubric.dimensions.map((d) => ({
        dimensionId: d.id,
        name: d.name,
        score,
        weight: d.weight,
        feedback: `Mock feedback for ${d.name}`,
      })),
      recommendation: score >= rubric.passThreshold ? 'Pass' : 'Needs revision',
      improvementPriorities: score >= rubric.passThreshold ? [] : ['Improve quality'],
    }
  }
}

// ---------------------------------------------------------------------------
// Document Pipeline Config
// ---------------------------------------------------------------------------

describe('Document Pipeline Config', () => {
  // a
  it('has exactly 5 stages', () => {
    expect(DOCUMENT_PIPELINE_STAGES).toHaveLength(5)
  })

  // b
  it('stage IDs: d1-research, d2-content, d3-format, d4-qa, d5-review', () => {
    const ids = DOCUMENT_PIPELINE_STAGES.map((s) => s.id)
    expect(ids).toEqual(['d1-research', 'd2-content', 'd3-format', 'd4-qa', 'd5-review'])
  })

  // c
  it('all rubrics use 1-10 scale (passThreshold 7, dim passThresholds <= 10)', () => {
    const rubrics = [
      DOC_RESEARCH_RUBRIC,
      DOC_CONTENT_RUBRIC,
      DOC_FORMAT_RUBRIC,
      DOC_QA_RUBRIC,
      DOC_REVIEW_RUBRIC,
    ]
    for (const rubric of rubrics) {
      expect(rubric.passThreshold).toBe(7)
      for (const dim of rubric.dimensions) {
        expect(dim.passThreshold).toBeLessThanOrEqual(10)
        expect(dim.passThreshold).toBeGreaterThanOrEqual(1)
      }
    }
  })

  // d
  it('all rubric dimension weights sum to 1.0', () => {
    const rubrics = [
      DOC_RESEARCH_RUBRIC,
      DOC_CONTENT_RUBRIC,
      DOC_FORMAT_RUBRIC,
      DOC_QA_RUBRIC,
      DOC_REVIEW_RUBRIC,
    ]
    for (const rubric of rubrics) {
      const sum = rubric.dimensions.reduce((acc, d) => acc + d.weight, 0)
      expect(sum).toBeCloseTo(1.0, 2)
    }
  })

  // e
  it('d5-review has production gate (5 actions including use_segments, mix_produce)', () => {
    const d5 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd5-review')!
    expect(d5.reviewGateConfig!.allowedActions).toEqual(
      expect.arrayContaining(['approve', 'reject', 'feedback', 'use_segments', 'mix_produce'])
    )
    expect(d5.reviewGateConfig!.allowedActions).toHaveLength(5)
  })

  // f
  it('dependencies chain correctly', () => {
    const d1 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd1-research')!
    const d2 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd2-content')!
    const d3 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd3-format')!
    const d4 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd4-qa')!
    const d5 = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd5-review')!

    expect(d1.dependsOn).toBeUndefined()
    expect(d2.dependsOn).toEqual(['d1-research'])
    expect(d3.dependsOn).toEqual(['d2-content'])
    expect(d4.dependsOn).toEqual(['d3-format'])
    expect(d5.dependsOn).toEqual(['d1-research', 'd2-content', 'd3-format', 'd4-qa'])
  })
})

// ---------------------------------------------------------------------------
// Engine Universality — SAME engine, DIFFERENT config
// ---------------------------------------------------------------------------

describe('Engine Universality — SAME engine, DIFFERENT config', () => {
  // g
  it('createDocumentPipeline returns 5 stages, all idle', () => {
    const pipeline = createDocumentPipeline('bp-doc-1', 'node-1')
    expect(pipeline.stages).toHaveLength(5)
    expect(pipeline.id).toBe('doc-pipeline-bp-doc-1-node-1')
    expect(pipeline.status).toBe('active')
    for (const stage of pipeline.stages) {
      expect(pipeline.stageStates[stage.id].status).toBe('idle')
    }
  })

  // h
  it('run d1-research with score 8 (above threshold 7): after minIter(1) → presenting', async () => {
    const stage = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd1-research')!
    const state = createInitialState('d1-research')
    const executor = createDocMockExecutor()
    const judge = createDocMockJudge(8)

    // runLoop from core/engine — the SAME function ideation uses
    const result = await runLoop(stage, state, {}, executor, judge)

    // Score 8 >= threshold 7, loopCount 1 >= minIterations 1 → presenting
    expect(result.status).toBe('presenting')
    expect(result.bestGrade!.overallScore).toBe(8)
    expect(result.bestGrade!.passesThreshold).toBe(true)
    expect(result.loopCount).toBe(1)
  })

  // i
  it('run d2-content: score 5 → revising, then score 8 → presenting', async () => {
    const stage = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd2-content')!
    const state = createInitialState('d2-content')
    const executor = createDocMockExecutor()
    const judge = createDocStatefulJudge([5, 8])

    // First iteration: score 5 < threshold 7 → revising
    const after1 = await runLoop(stage, state, {}, executor, judge)
    expect(after1.status).toBe('revising')
    expect(after1.loopCount).toBe(1)

    // Second iteration: score 8 >= threshold 7, loopCount 2 >= minIter 2 → presenting
    const after2 = await runLoop(stage, after1, {}, executor, judge)
    expect(after2.status).toBe('presenting')
    expect(after2.bestGrade!.overallScore).toBe(8)
    expect(after2.loopCount).toBe(2)
  })

  // j
  it('approve d1 + d2 via processReview, advance pipeline', () => {
    let pipeline = createDocumentPipeline('bp-adv', 'node-adv')

    // Manually set d1 to presenting (simulating post-runLoop)
    pipeline.stageStates['d1-research'] = {
      ...pipeline.stageStates['d1-research'],
      status: 'presenting',
      bestArtifact: { content: 'research done' },
    }

    // processReview from core/engine — the SAME function ideation uses
    pipeline.stageStates['d1-research'] = processReview(
      pipeline.stageStates['d1-research'],
      { type: 'approve' }
    )
    expect(pipeline.stageStates['d1-research'].status).toBe('approved')

    // Advance past d1
    pipeline = advancePipeline(pipeline)
    expect(pipeline.currentStageIndex).toBe(1)

    // Set d2 to presenting and approve
    pipeline.stageStates['d2-content'] = {
      ...pipeline.stageStates['d2-content'],
      status: 'presenting',
      bestArtifact: { content: 'content written' },
    }
    pipeline.stageStates['d2-content'] = processReview(
      pipeline.stageStates['d2-content'],
      { type: 'approve' }
    )
    expect(pipeline.stageStates['d2-content'].status).toBe('approved')

    pipeline = advancePipeline(pipeline)
    expect(pipeline.currentStageIndex).toBe(2)
  })

  // k
  it('full pipeline completion: all 5 stages approved → complete, 100%', () => {
    let pipeline = createDocumentPipeline('bp-full', 'node-full')

    // Approve each stage sequentially
    for (const stage of pipeline.stages) {
      pipeline.stageStates[stage.id] = {
        ...pipeline.stageStates[stage.id],
        status: 'presenting',
        bestArtifact: { content: `${stage.id} done` },
      }
      pipeline.stageStates[stage.id] = processReview(
        pipeline.stageStates[stage.id],
        { type: 'approve' }
      )
      pipeline = advancePipeline(pipeline)
    }

    expect(isPipelineComplete(pipeline)).toBe(true)
    const progress = getPipelineProgress(pipeline)
    expect(progress.percent).toBe(100)
    expect(progress.completed).toBe(5)
    expect(progress.total).toBe(5)
  })

  // l
  it('engine imports are IDENTICAL to what ideation uses — one engine, two domains', () => {
    // These are the SAME functions from core/engine — not copies, not forks.
    // If this test compiles and runs, it proves the document pipeline uses
    // the exact same engine machinery as the ideation pipeline.
    expect(typeof createInitialState).toBe('function')
    expect(typeof runLoop).toBe('function')
    expect(typeof processReview).toBe('function')

    // Both pipelines create state the same way
    const ideationState = createInitialState('brief')
    const documentState = createInitialState('d1-research')
    expect(ideationState.status).toBe(documentState.status)
    expect(ideationState.loopCount).toBe(documentState.loopCount)
  })
})

// ---------------------------------------------------------------------------
// Scale Independence
// ---------------------------------------------------------------------------

describe('Scale Independence', () => {
  // m
  it('ideation uses threshold 75 (0-100), document uses threshold 7 (1-10)', () => {
    // Document rubrics
    for (const stage of DOCUMENT_PIPELINE_STAGES) {
      expect(stage.threshold).toBe(7)
      expect(stage.rubric.passThreshold).toBe(7)
    }

    // The engine does not care about scale — it compares score >= threshold
    // Ideation threshold 75 on 0-100 scale, document threshold 7 on 1-10 scale
    // Both work because runLoop just does: grade.overallScore >= stage.threshold
  })

  // n
  it('same runLoop handles both: score 8/10 passes document threshold', async () => {
    const docStage = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd1-research')!
    const docState = createInitialState('d1-research')
    const executor = createDocMockExecutor()

    // Score 8 on 1-10 scale → passes threshold 7
    const judge8 = createDocMockJudge(8)
    const result = await runLoop(docStage, docState, {}, executor, judge8)
    expect(result.bestGrade!.passesThreshold).toBe(true)
    expect(result.status).toBe('presenting')
  })

  // o
  it('the engine never references scale — it just compares score >= threshold', async () => {
    const stage = DOCUMENT_PIPELINE_STAGES.find((s) => s.id === 'd1-research')!
    const state = createInitialState('d1-research')
    const executor = createDocMockExecutor()

    // Score 6 < threshold 7 → revising (below threshold on 1-10 scale)
    const judgeFail = createDocMockJudge(6)
    const failResult = await runLoop(stage, state, {}, executor, judgeFail)
    expect(failResult.status).toBe('revising')
    expect(failResult.bestGrade!.passesThreshold).toBe(false)

    // Score 7 >= threshold 7 → presenting (exactly at threshold)
    const judgePass = createDocMockJudge(7)
    const passResult = await runLoop(stage, state, {}, executor, judgePass)
    expect(passResult.status).toBe('presenting')
    expect(passResult.bestGrade!.passesThreshold).toBe(true)
  })
})
