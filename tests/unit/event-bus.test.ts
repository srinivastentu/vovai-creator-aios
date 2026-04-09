import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventBus } from '../../src/lib/event-bus'
import type { PhaseTransitionEvent, GradeCompletedEvent, ReviewActionEvent } from '../../src/lib/event-bus'

beforeEach(() => {
  eventBus.clear()
})

describe('EventBus', () => {
  it('calls handler when event is emitted', () => {
    const handler = vi.fn()
    eventBus.on('phase.transition', handler)

    const event: PhaseTransitionEvent = {
      blueprintId: 'bp-001',
      from: 'brainstorm',
      to: 'structure',
      timestamp: new Date(),
    }
    eventBus.emit('phase.transition', event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('supports multiple handlers for the same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    eventBus.on('grade.completed', handler1)
    eventBus.on('grade.completed', handler2)

    const event: GradeCompletedEvent = {
      blueprintId: 'bp-001',
      score: 82,
      recommendation: 'revise',
      loopCount: 1,
      timestamp: new Date(),
    }
    eventBus.emit('grade.completed', event)

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('does not call handler after off()', () => {
    const handler = vi.fn()
    eventBus.on('review.action', handler)
    eventBus.off('review.action', handler)

    eventBus.emit('review.action', {
      blueprintId: 'bp-001',
      action: 'approve',
      timestamp: new Date(),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not call handlers for different events', () => {
    const handler = vi.fn()
    eventBus.on('phase.transition', handler)

    eventBus.emit('grade.completed', {
      blueprintId: 'bp-001',
      score: 75,
      recommendation: 'revise',
      loopCount: 2,
      timestamp: new Date(),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('survives handler that throws', () => {
    const badHandler = vi.fn(() => { throw new Error('boom') })
    const goodHandler = vi.fn()
    eventBus.on('phase.transition', badHandler)
    eventBus.on('phase.transition', goodHandler)

    const event: PhaseTransitionEvent = {
      blueprintId: 'bp-001',
      from: 'refinement',
      to: 'review',
      timestamp: new Date(),
    }
    eventBus.emit('phase.transition', event)

    expect(badHandler).toHaveBeenCalledOnce()
    expect(goodHandler).toHaveBeenCalledOnce()
  })

  it('clear() removes all listeners', () => {
    eventBus.on('phase.transition', vi.fn())
    eventBus.on('grade.completed', vi.fn())

    expect(eventBus.listenerCount('phase.transition')).toBe(1)
    expect(eventBus.listenerCount('grade.completed')).toBe(1)

    eventBus.clear()

    expect(eventBus.listenerCount('phase.transition')).toBe(0)
    expect(eventBus.listenerCount('grade.completed')).toBe(0)
  })

  it('listenerCount returns 0 for events with no listeners', () => {
    expect(eventBus.listenerCount('artifact.created')).toBe(0)
  })

  it('emitting an event with no listeners does not throw', () => {
    expect(() => {
      eventBus.emit('cost.recorded', {
        blueprintId: 'bp-001',
        costUSD: 0.05,
        model: 'claude-sonnet-4-20250514',
        timestamp: new Date(),
      })
    }).not.toThrow()
  })
})
