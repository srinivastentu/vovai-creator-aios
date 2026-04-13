import { describe, expect, it, vi } from 'vitest'
import type { ModelGateway } from '../../models/gateway'
import type { GatewayRequest, GatewayResponse } from '../../models/types'
import type { GradeReport, JudgeFunction, RubricDefinition } from '../types'
import { buildRefinedPrompt, createTournamentRunner } from '../tournament'
import type {
  ImageArtifact,
  TournamentConfig,
  TournamentEvent,
  TournamentResult,
  TournamentValidator,
} from '../tournament-types'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const RUBRIC: RubricDefinition = {
  id: 'test-rubric',
  name: 'Test',
  passThreshold: 7,
  dimensions: [
    { id: 'a', name: 'Alpha', weight: 0.5, passThreshold: 6, description: 'a', criteria: {} },
    { id: 'b', name: 'Beta', weight: 0.5, passThreshold: 6, description: 'b', criteria: {} },
  ],
}

function makeGrade(score: number, dims: { a?: number; b?: number } = {}): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= 7,
    dimensionScores: [
      { dimensionId: 'a', name: 'Alpha', score: dims.a ?? score, weight: 0.5, feedback: `feedback for a @ ${dims.a ?? score}` },
      { dimensionId: 'b', name: 'Beta', score: dims.b ?? score, weight: 0.5, feedback: `feedback for b @ ${dims.b ?? score}` },
    ],
    recommendation: 'test',
    improvementPriorities: [],
  }
}

function genSuccess(modelId: string, filePath: string, costUsd = 0.01): GatewayResponse {
  return {
    success: true,
    modelId,
    providerId: 'test',
    capability: 'image-generation',
    result: { filePath },
    cost: { costUsd, durationMs: 100, unit: 'image' },
    metadata: {},
  }
}

function genFailure(modelId: string, error = 'timeout', costUsd = 0): GatewayResponse {
  return {
    success: false,
    modelId,
    providerId: 'test',
    capability: 'image-generation',
    result: {},
    cost: { costUsd, durationMs: 100, unit: 'none' },
    error,
    metadata: {},
  }
}

interface MockGateway {
  gateway: ModelGateway
  requestMultiple: ReturnType<typeof vi.fn>
}

function makeGateway(
  responsesPerCall: GatewayResponse[][]
): MockGateway {
  const calls = [...responsesPerCall]
  const requestMultiple = vi.fn(async (_req: GatewayRequest, modelIds: string[]) => {
    const next = calls.shift()
    if (!next) return modelIds.map((id) => genFailure(id, 'no mock response'))
    return next
  })
  const gateway = {
    request: vi.fn(),
    requestMultiple,
    getAvailableModels: vi.fn(() => []),
    getCostSummary: vi.fn(),
    getCostTable: vi.fn(() => []),
    getHealthDashboard: vi.fn(() => new Map()),
  } as unknown as ModelGateway
  return { gateway, requestMultiple }
}

function makeJudge(scoresByModel: Map<string, number | number[]>): {
  judge: JudgeFunction
  calls: { artifact: ImageArtifact; round: number }[]
} {
  const calls: { artifact: ImageArtifact; round: number }[] = []
  const callCounts = new Map<string, number>()
  const judge: JudgeFunction = async (artifact) => {
    const a = artifact as ImageArtifact
    // Infer modelId from path suffix: test files use `${modelId}.png`
    const modelMatch = a.imagePath.match(/\/([^/]+)\.png$/)
    const modelId = modelMatch?.[1] ?? 'unknown'
    const entry = scoresByModel.get(modelId)
    const nth = callCounts.get(modelId) ?? 0
    callCounts.set(modelId, nth + 1)
    let score: number
    if (Array.isArray(entry)) score = entry[Math.min(nth, entry.length - 1)] ?? 4
    else score = entry ?? 4
    calls.push({ artifact: a, round: nth + 1 })
    return makeGrade(score)
  }
  return { judge, calls }
}

function makeValidators(failingPaths: Set<string> = new Set()): TournamentValidator[] {
  const check: TournamentValidator = (artifact) => {
    const a = artifact as ImageArtifact
    if (failingPaths.has(a.imagePath)) {
      return { pass: false, name: 'fakeValidator', message: `rejected ${a.imagePath}` }
    }
    return { pass: true, name: 'fakeValidator', message: 'ok' }
  }
  return [check]
}

async function collect(
  generator: AsyncGenerator<TournamentEvent, TournamentResult, void>
): Promise<{ events: TournamentEvent[]; result: TournamentResult }> {
  const events: TournamentEvent[] = []
  while (true) {
    const { value, done } = await generator.next()
    if (done) return { events, result: value }
    events.push(value)
  }
}

function baseConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    modelIds: ['m1', 'm2', 'm3'],
    maxRounds: 2,
    threshold: 7.5,
    topN: 2,
    timeoutPerModelMs: 60_000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTournamentRunner', () => {
  it('1. happy path — Round 1 winner at or above threshold', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png'), genSuccess('m3', '/tmp/m3.png')],
    ])
    const { judge } = makeJudge(new Map([['m1', 7.0], ['m2', 8.5], ['m3', 6.0]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(runner('a cat', baseConfig()))
    expect(result.method).toBe('threshold_met')
    expect(result.winner?.modelId).toBe('m2')
    expect(result.winner?.grade?.overallScore).toBe(8.5)
  })

  it('2. Round 2 triggered — best R1 below threshold, R2 winner selected', async () => {
    const { gateway, requestMultiple } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png'), genSuccess('m3', '/tmp/m3.png')],
      [genSuccess('m1', '/tmp/r2-m1.png'), genSuccess('m2', '/tmp/r2-m2.png')],
    ])
    const { judge } = makeJudge(
      new Map<string, number | number[]>([
        ['m1', [7.0, 7.0]],
        ['m2', [6.5, 8.0]],
        ['m3', 5.0],
        ['r2-m1', 7.0],
        ['r2-m2', 8.0],
      ])
    )
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(runner('a cat', baseConfig()))
    expect(requestMultiple).toHaveBeenCalledTimes(2)
    expect(result.method).toBe('threshold_met')
    expect(result.winner?.round).toBe(2)
    expect(result.winner?.grade?.overallScore).toBe(8.0)
  })

  it('3. Round 1 entry wins across rounds (best-version tracking)', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png')],
      [genSuccess('m1', '/tmp/r2-m1.png'), genSuccess('m2', '/tmp/r2-m2.png')],
    ])
    // R1 best is m1 at 7.8 (below threshold 8.5). R2 entries score lower.
    const { judge } = makeJudge(
      new Map<string, number>([
        ['m1', 7.8],
        ['m2', 6.0],
        ['r2-m1', 7.5],
        ['r2-m2', 7.0],
      ])
    )
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(
      runner('a cat', baseConfig({ threshold: 8.5, modelIds: ['m1', 'm2'] }))
    )
    expect(result.method).toBe('escalation')
    expect(result.bestEntry?.round).toBe(1)
    expect(result.bestEntry?.grade?.overallScore).toBe(7.8)
  })

  it('4. Escalation — max rounds reached, bestEntry is not null', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png')],
      [genSuccess('m1', '/tmp/r2-m1.png'), genSuccess('m2', '/tmp/r2-m2.png')],
    ])
    const { judge } = makeJudge(
      new Map<string, number>([['m1', 5], ['m2', 5.5], ['r2-m1', 6], ['r2-m2', 6.5]])
    )
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(runner('x', baseConfig({ modelIds: ['m1', 'm2'] })))
    expect(result.method).toBe('escalation')
    expect(result.winner).toBeNull()
    expect(result.bestEntry).not.toBeNull()
    expect(result.bestEntry?.grade?.overallScore).toBe(6.5)
  })

  it('5. All generations fail — all_failed', async () => {
    const { gateway } = makeGateway([
      [genFailure('m1'), genFailure('m2'), genFailure('m3')],
      [genFailure('m1'), genFailure('m2')],
    ])
    const { judge } = makeJudge(new Map())
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result, events } = await collect(runner('x', baseConfig()))
    expect(result.method).toBe('all_failed')
    expect(result.winner).toBeNull()
    expect(result.bestEntry).toBeNull()
    expect(events.some((e) => e.type === 'tournament:all-failed')).toBe(true)
  })

  it('6. Validator filters bad images — judge called only for survivors', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png'), genSuccess('m3', '/tmp/m3.png')],
    ])
    const { judge, calls } = makeJudge(
      new Map<string, number>([['m1', 8.5], ['m2', 8.0], ['m3', 9.0]])
    )
    const validators = makeValidators(new Set(['/tmp/m3.png']))
    const runner = createTournamentRunner(gateway, judge, validators, RUBRIC)
    const { result } = await collect(runner('x', baseConfig()))
    expect(calls.length).toBe(2)
    expect(result.winner?.modelId).toBe('m1')
  })

  it('7. All validators fail — judge never called, escalation via all_failed', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png')],
      [genSuccess('m1', '/tmp/r2.png')],
    ])
    const { judge, calls } = makeJudge(new Map())
    const validators = makeValidators(new Set(['/tmp/m1.png', '/tmp/m2.png', '/tmp/r2.png']))
    const runner = createTournamentRunner(gateway, judge, validators, RUBRIC)
    const { result } = await collect(runner('x', baseConfig({ modelIds: ['m1', 'm2'] })))
    expect(calls.length).toBe(0)
    expect(result.method).toBe('all_failed')
  })

  it('8. Events emitted in correct order', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png')],
    ])
    const { judge } = makeJudge(new Map([['m1', 8.5], ['m2', 7.0]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { events } = await collect(runner('x', baseConfig({ modelIds: ['m1', 'm2'] })))
    const types = events.map((e) => e.type)
    expect(types[0]).toBe('tournament:round-start')
    expect(types).toContain('tournament:generation-complete')
    expect(types).toContain('tournament:validation-complete')
    expect(types.filter((t) => t === 'tournament:entry-judged').length).toBe(2)
    expect(types).toContain('tournament:round-complete')
    expect(types[types.length - 1]).toBe('tournament:winner-selected')
    // Order check
    expect(types.indexOf('tournament:generation-complete')).toBeLessThan(
      types.indexOf('tournament:validation-complete')
    )
    expect(types.indexOf('tournament:validation-complete')).toBeLessThan(
      types.indexOf('tournament:entry-judged')
    )
    expect(types.lastIndexOf('tournament:entry-judged')).toBeLessThan(
      types.indexOf('tournament:round-complete')
    )
  })

  it('9. entry-judged events contain modelId and score', async () => {
    const { gateway } = makeGateway([
      [genSuccess('m1', '/tmp/m1.png'), genSuccess('m2', '/tmp/m2.png')],
    ])
    const { judge } = makeJudge(new Map([['m1', 8.5], ['m2', 7.25]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { events } = await collect(runner('x', baseConfig({ modelIds: ['m1', 'm2'] })))
    const judged = events.filter((e) => e.type === 'tournament:entry-judged')
    expect(judged[0].data.modelId).toBe('m1')
    expect(judged[0].data.score).toBe(8.5)
    expect(judged[1].data.modelId).toBe('m2')
    expect(judged[1].data.score).toBe(7.25)
  })

  it('10. Refined prompt contains PRESERVE for ≥8 and IMPROVE for <8', () => {
    const grade: GradeReport = {
      overallScore: 7,
      passesThreshold: false,
      dimensionScores: [
        { dimensionId: 'a', name: 'Alpha', score: 9, weight: 0.5, feedback: 'crisp' },
        { dimensionId: 'b', name: 'Beta', score: 6, weight: 0.5, feedback: 'needs more detail' },
      ],
      recommendation: 'revise',
      improvementPriorities: [],
    }
    const refined = buildRefinedPrompt('ORIGINAL PROMPT', grade, RUBRIC)
    expect(refined).toContain('PRESERVE')
    expect(refined).toContain('Alpha')
    expect(refined).toContain('IMPROVE')
    expect(refined).toContain('Beta')
    expect(refined).toContain('needs more detail')
    // 9 ≥ 8 goes to PRESERVE, 6 < 8 goes to IMPROVE.
    const preserveIdx = refined.indexOf('PRESERVE')
    const improveIdx = refined.indexOf('IMPROVE')
    expect(refined.indexOf('Alpha')).toBeGreaterThan(preserveIdx)
    expect(refined.indexOf('Beta')).toBeGreaterThan(improveIdx)
  })

  it('11. Refined prompt includes original prompt text', () => {
    const grade = makeGrade(7)
    const refined = buildRefinedPrompt('THE ORIGINAL', grade, RUBRIC)
    expect(refined).toContain('THE ORIGINAL')
  })

  it('12. Total cost sums generation + judge costs', async () => {
    const { gateway } = makeGateway([
      [
        genSuccess('m1', '/tmp/m1.png', 0.01),
        genSuccess('m2', '/tmp/m2.png', 0.01),
        genSuccess('m3', '/tmp/m3.png', 0.01),
      ],
    ])
    const { judge } = makeJudge(new Map([['m1', 7.0], ['m2', 8.5], ['m3', 6.0]]))
    let judgeCostSum = 0
    const onJudgeCall = () => {
      judgeCostSum += 0.005
    }
    const wrappedJudge: JudgeFunction = async (a, r, ctx) => {
      onJudgeCall()
      return judge(a, r, ctx)
    }
    const runner = createTournamentRunner(gateway, wrappedJudge, makeValidators(), RUBRIC, {
      getJudgeCostUsd: () => judgeCostSum,
    })
    const { result } = await collect(runner('x', baseConfig()))
    // 3 generations × $0.01 + 3 judge calls × $0.005 = $0.045
    expect(result.totalCostUsd).toBeCloseTo(0.045, 5)
  })

  it('13. Failed generations still count cost if provider charged', async () => {
    const { gateway } = makeGateway([
      [
        genFailure('m1', 'timeout', 0.002),
        genSuccess('m2', '/tmp/m2.png', 0.01),
        genFailure('m3', 'timeout', 0.002),
      ],
    ])
    const { judge } = makeJudge(new Map([['m2', 8.5]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(runner('x', baseConfig()))
    // 0.002 + 0.01 + 0.002 = 0.014 (no judge cost accumulator provided)
    expect(result.totalCostUsd).toBeCloseTo(0.014, 5)
  })

  it('14. Single model tournament works', async () => {
    const { gateway } = makeGateway([[genSuccess('m1', '/tmp/m1.png')]])
    const { judge } = makeJudge(new Map([['m1', 8.5]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result } = await collect(runner('x', baseConfig({ modelIds: ['m1'] })))
    expect(result.method).toBe('threshold_met')
    expect(result.winner?.modelId).toBe('m1')
  })

  it('15. Timeout handling — one model fails, others continue', async () => {
    const { gateway } = makeGateway([
      [
        genFailure('m1', 'timeout'),
        genSuccess('m2', '/tmp/m2.png'),
        genSuccess('m3', '/tmp/m3.png'),
      ],
    ])
    const { judge } = makeJudge(new Map([['m2', 8.5], ['m3', 7.0]]))
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result, events } = await collect(runner('x', baseConfig()))
    expect(result.method).toBe('threshold_met')
    expect(result.winner?.modelId).toBe('m2')
    const genFailEvents = events.filter((e) => e.type === 'tournament:generation-failed')
    expect(genFailEvents.length).toBe(1)
    expect(genFailEvents[0].data.modelId).toBe('m1')
  })

  it('16. Empty modelIds — immediately all_failed, no gateway calls', async () => {
    const { gateway, requestMultiple } = makeGateway([])
    const { judge, calls } = makeJudge(new Map())
    const runner = createTournamentRunner(gateway, judge, makeValidators(), RUBRIC)
    const { result, events } = await collect(runner('x', baseConfig({ modelIds: [] })))
    expect(result.method).toBe('all_failed')
    expect(requestMultiple).not.toHaveBeenCalled()
    expect(calls.length).toBe(0)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('tournament:all-failed')
  })
})
