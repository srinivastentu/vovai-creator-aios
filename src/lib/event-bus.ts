/**
 * Event Bus — Simple in-process event emitter.
 *
 * Level 1 (Engine). Every state change emits an event; components
 * react, never poll. This is the foundation for observability,
 * cost tracking, and future webhook/SSE integrations.
 *
 * Usage:
 *   eventBus.on('phase.transition', handler)
 *   eventBus.emit('phase.transition', { from: 'brainstorm', to: 'structure', blueprintId })
 *   eventBus.off('phase.transition', handler)
 */

// ─── Event Types ─────────────────────────────────────────────────────────────

export interface PhaseTransitionEvent {
  blueprintId: string
  from: string
  to: string
  timestamp: Date
}

export interface GradeCompletedEvent {
  blueprintId: string
  score: number
  recommendation: string
  loopCount: number
  timestamp: Date
}

export interface ReviewActionEvent {
  blueprintId: string
  action: 'approve' | 'feedback' | 'restructure'
  timestamp: Date
}

export interface ArtifactCreatedEvent {
  stageSessionId: string
  artifactId: string
  version: number
  stage: string
  timestamp: Date
}

export interface CostRecordedEvent {
  blueprintId: string
  costUSD: number
  model: string
  timestamp: Date
}

export interface EventMap {
  'phase.transition': PhaseTransitionEvent
  'grade.completed': GradeCompletedEvent
  'review.action': ReviewActionEvent
  'artifact.created': ArtifactCreatedEvent
  'cost.recorded': CostRecordedEvent
}

export type EventName = keyof EventMap

// ─── Event Bus ───────────────────────────────────────────────────────────────

type Handler<T> = (event: T) => void

class EventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>()

  on<K extends EventName>(event: K, handler: Handler<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>)
  }

  off<K extends EventName>(event: K, handler: Handler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>)
  }

  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(data)
      } catch {
        // Handlers must not crash the emitter.
        // In production, this would log to an error tracking service.
      }
    }
  }

  /** Remove all listeners. Useful for tests. */
  clear(): void {
    this.listeners.clear()
  }

  /** Number of listeners for a given event. Useful for tests. */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0
  }
}

/** Singleton event bus — one per process */
export const eventBus = new EventBus()
