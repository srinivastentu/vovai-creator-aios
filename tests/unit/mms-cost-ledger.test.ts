import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCostLedger } from '../../src/lib/core/models/cost-ledger'
import type { CostRecord } from '../../src/lib/core/models/types'

const makeRecord = (overrides: Partial<CostRecord> = {}): CostRecord => ({
  id: overrides.id ?? `r-${Math.random()}`,
  timestamp: overrides.timestamp ?? '2026-04-13T00:00:00.000Z',
  modelId: 'm1',
  providerId: 'p1',
  capability: 'image-generation',
  success: true,
  costUsd: 0.05,
  durationMs: 100,
  tokensIn: 0,
  tokensOut: 0,
  context: {},
  ...overrides,
})

describe('CostLedger', () => {
  const origLog = console.log
  beforeAll(() => {
    console.log = () => {}
  })
  afterAll(() => {
    console.log = origLog
  })

  it('record appends and getRecordCount increments', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord())
    l.record(makeRecord())
    expect(l.getRecordCount()).toBe(2)
  })

  it('getTotal with no filter sums all records', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ costUsd: 0.1 }))
    l.record(makeRecord({ costUsd: 0.2, success: false }))
    const t = l.getTotal()
    expect(t.totalCostUsd).toBeCloseTo(0.3)
    expect(t.callCount).toBe(2)
    expect(t.successCount).toBe(1)
    expect(t.failureCount).toBe(1)
    expect(t.successRate).toBe(0.5)
    expect(t.avgCostUsd).toBeCloseTo(0.15)
  })

  it('filters by modelId', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ modelId: 'a', costUsd: 0.1 }))
    l.record(makeRecord({ modelId: 'b', costUsd: 0.2 }))
    expect(l.getTotal({ modelId: 'a' }).totalCostUsd).toBeCloseTo(0.1)
  })

  it('filters by providerId', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ providerId: 'x', costUsd: 0.1 }))
    l.record(makeRecord({ providerId: 'y', costUsd: 0.2 }))
    expect(l.getTotal({ providerId: 'y' }).totalCostUsd).toBeCloseTo(0.2)
  })

  it('filters by projectId via context', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ context: { projectId: 'p1' }, costUsd: 0.1 }))
    l.record(makeRecord({ context: { projectId: 'p2' }, costUsd: 0.2 }))
    expect(l.getTotal({ projectId: 'p2' }).totalCostUsd).toBeCloseTo(0.2)
  })

  it('filters by callerTag', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ context: { callerTag: 'agent-a' }, costUsd: 0.1 }))
    l.record(makeRecord({ context: { callerTag: 'agent-b' }, costUsd: 0.2 }))
    expect(l.getTotal({ callerTag: 'agent-a' }).totalCostUsd).toBeCloseTo(0.1)
  })

  it('filters by timeRange after/before', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ timestamp: '2026-01-01T00:00:00.000Z', costUsd: 0.1 }))
    l.record(makeRecord({ timestamp: '2026-06-01T00:00:00.000Z', costUsd: 0.2 }))
    l.record(makeRecord({ timestamp: '2026-12-01T00:00:00.000Z', costUsd: 0.3 }))
    const t = l.getTotal({
      after: '2026-03-01T00:00:00.000Z',
      before: '2026-09-01T00:00:00.000Z',
    })
    expect(t.totalCostUsd).toBeCloseTo(0.2)
    expect(t.callCount).toBe(1)
  })

  it('combines filters with AND logic', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ modelId: 'a', providerId: 'x', costUsd: 0.1 }))
    l.record(makeRecord({ modelId: 'a', providerId: 'y', costUsd: 0.2 }))
    l.record(makeRecord({ modelId: 'b', providerId: 'x', costUsd: 0.4 }))
    expect(l.getTotal({ modelId: 'a', providerId: 'y' }).totalCostUsd).toBeCloseTo(0.2)
  })

  it('getSummaryTable groups by model with avgCost and successRate', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ modelId: 'a', costUsd: 0.1, success: true, durationMs: 100 }))
    l.record(makeRecord({ modelId: 'a', costUsd: 0.3, success: false, durationMs: 300 }))
    l.record(makeRecord({ modelId: 'b', costUsd: 1.0, success: true, durationMs: 200 }))
    const table = l.getSummaryTable()
    expect(table[0].modelId).toBe('b')
    const a = table.find((r) => r.modelId === 'a')!
    expect(a.callCount).toBe(2)
    expect(a.avgCostUsd).toBeCloseTo(0.2)
    expect(a.avgDurationMs).toBeCloseTo(200)
    expect(a.successRate).toBe(0.5)
  })

  it('getByModel returns matching records', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ modelId: 'a' }))
    l.record(makeRecord({ modelId: 'b' }))
    l.record(makeRecord({ modelId: 'a' }))
    expect(l.getByModel('a')).toHaveLength(2)
  })

  it('exportToJsonl writes one JSON per line', async () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord({ id: 'r1' }))
    l.record(makeRecord({ id: 'r2' }))
    const path = join(tmpdir(), `ledger-${Date.now()}.jsonl`)
    await l.exportToJsonl(path)
    const body = await readFile(path, 'utf8')
    const lines = body.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).id).toBe('r1')
    expect(JSON.parse(lines[1]).id).toBe('r2')
    await unlink(path)
  })

  it('clear resets everything', () => {
    const l = createCostLedger({ silent: true })
    l.record(makeRecord())
    l.record(makeRecord())
    l.clear()
    expect(l.getRecordCount()).toBe(0)
    expect(l.getTotal().totalCostUsd).toBe(0)
  })
})
