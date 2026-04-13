import { describe, it, expect } from 'vitest'
import { createHealthMonitor } from '../../src/lib/core/models/health-monitor'

describe('HealthMonitor', () => {
  it('returns healthy when no data yet', () => {
    const h = createHealthMonitor()
    const s = h.getHealth('p')
    expect(s.status).toBe('healthy')
    expect(s.sampleSize).toBe(0)
  })

  it('classifies all-success as healthy', () => {
    const h = createHealthMonitor()
    for (let i = 0; i < 10; i += 1) h.recordOutcome('p', true, 100)
    expect(h.getHealth('p').status).toBe('healthy')
  })

  it('classifies 70% success as degraded', () => {
    const h = createHealthMonitor()
    for (let i = 0; i < 7; i += 1) h.recordOutcome('p', true, 100)
    for (let i = 0; i < 3; i += 1) h.recordOutcome('p', false, 100, 'err')
    expect(h.getHealth('p').status).toBe('degraded')
  })

  it('classifies 40% success as down', () => {
    const h = createHealthMonitor()
    for (let i = 0; i < 4; i += 1) h.recordOutcome('p', true, 100)
    for (let i = 0; i < 6; i += 1) h.recordOutcome('p', false, 100, 'err')
    expect(h.getHealth('p').status).toBe('down')
  })

  it('calculates avgLatencyMs correctly', () => {
    const h = createHealthMonitor()
    h.recordOutcome('p', true, 100)
    h.recordOutcome('p', true, 200)
    h.recordOutcome('p', true, 300)
    expect(h.getHealth('p').avgLatencyMs).toBeCloseTo(200)
  })

  it('tracks the most recent error', () => {
    const h = createHealthMonitor()
    h.recordOutcome('p', false, 100, 'first')
    h.recordOutcome('p', true, 100)
    h.recordOutcome('p', false, 100, 'latest')
    expect(h.getHealth('p').lastError).toBe('latest')
  })

  it('rolling window drops old entries when full', () => {
    const h = createHealthMonitor({ windowSize: 3 })
    h.recordOutcome('p', false, 100, 'old')
    h.recordOutcome('p', true, 100)
    h.recordOutcome('p', true, 100)
    h.recordOutcome('p', true, 100)
    const s = h.getHealth('p')
    expect(s.sampleSize).toBe(3)
    expect(s.successRate).toBe(1)
  })

  it('reset clears provider history', () => {
    const h = createHealthMonitor()
    h.recordOutcome('p', false, 100, 'err')
    h.reset('p')
    expect(h.getHealth('p').sampleSize).toBe(0)
  })
})
