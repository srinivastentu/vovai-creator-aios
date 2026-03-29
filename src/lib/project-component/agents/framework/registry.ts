/**
 * Agent Registry — Register, retrieve, and list ideation agents
 *
 * Simple in-memory registry. Agents register their config at startup.
 * The orchestrator and loop engine look up agents by ID.
 *
 * Level 1 (Engine) — domain-agnostic registry.
 */

import type { IdeationAgentConfig } from './types'

// ─── Registry Store ────────────────────────────────────────────────────────

const agents = new Map<string, IdeationAgentConfig>()

// ─── Public API ────────────────────────────────────────────────────────────

/** Register an agent config. Throws if ID already registered. */
export function registerAgent(config: IdeationAgentConfig): void {
  if (agents.has(config.id)) {
    throw new Error(`Agent already registered: ${config.id}`)
  }
  agents.set(config.id, config)
}

/** Get an agent config by ID. Returns undefined if not found. */
export function getAgent(id: string): IdeationAgentConfig | undefined {
  return agents.get(id)
}

/** List all registered agents. */
export function listAgents(): IdeationAgentConfig[] {
  return Array.from(agents.values())
}

/** Clear all registered agents. Used in tests. */
export function clearAgents(): void {
  agents.clear()
}
