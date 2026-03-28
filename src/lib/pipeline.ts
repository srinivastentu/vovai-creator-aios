/**
 * Pipeline stage definitions — single source of truth for all 16 eLearn stages.
 */
import type { StageConfig } from "./types"

export const STAGES: StageConfig[] = [
  // Ring 1 — Script
  { id: 1, name: "Discovery", ring: 1, agent: null, dependencies: [], reviewGate: false, perScene: false, tournament: false, strategicPhase: true, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 2, name: "Script Writing", ring: 1, agent: null, dependencies: [1], reviewGate: false, perScene: true, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 3, name: "Script Review", ring: 1, agent: null, dependencies: [2], reviewGate: true, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 0, minIterations: 0 },

  // Ring 2 — Visual
  { id: 4, name: "Image Prompt Engineering", ring: 2, agent: null, dependencies: [3], reviewGate: false, perScene: true, tournament: false, strategicPhase: false, agentInnerPlanning: true, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 5, name: "Image Generation", ring: 2, agent: null, dependencies: [4], reviewGate: false, perScene: true, tournament: true, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 6, name: "AV Storyboard Assembly", ring: 2, agent: null, dependencies: [5], reviewGate: false, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: true, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 7, name: "Storyboard Review", ring: 2, agent: null, dependencies: [6], reviewGate: true, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 0, minIterations: 0 },

  // Ring 3 — Audio + Video
  { id: 8, name: "Voice-Over Generation", ring: 3, agent: null, dependencies: [7], reviewGate: false, perScene: true, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 9, name: "Video Generation", ring: 3, agent: null, dependencies: [7], reviewGate: false, perScene: true, tournament: true, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 10, name: "Music & SFX", ring: 3, agent: null, dependencies: [7], reviewGate: false, perScene: false, tournament: true, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 11, name: "Per-Scene Assembly", ring: 3, agent: null, dependencies: [8, 9, 10], reviewGate: false, perScene: true, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 12, name: "Full Assembly", ring: 3, agent: null, dependencies: [11], reviewGate: false, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },

  // Ring 4 — Finish
  { id: 13, name: "Captions & Subtitles", ring: 4, agent: null, dependencies: [12], reviewGate: false, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 14, name: "Final Render", ring: 4, agent: null, dependencies: [13], reviewGate: false, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 15, name: "Quality Assurance", ring: 4, agent: null, dependencies: [14], reviewGate: false, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 5, minIterations: 2 },
  { id: 16, name: "Packaging & Delivery", ring: 4, agent: null, dependencies: [15], reviewGate: true, perScene: false, tournament: false, strategicPhase: false, agentInnerPlanning: false, rubric: "", threshold: 7.5, maxIterations: 0, minIterations: 0 },
]

export const RINGS = [
  { ring: 1, label: "Script", stages: [1, 2, 3] },
  { ring: 2, label: "Visual", stages: [4, 5, 6, 7] },
  { ring: 3, label: "Audio + Video", stages: [8, 9, 10, 11, 12] },
  { ring: 4, label: "Finish", stages: [13, 14, 15, 16] },
] as const

export function getStage(id: number): StageConfig {
  const stage = STAGES.find((s) => s.id === id)
  if (!stage) throw new Error(`Stage ${id} not found`)
  return stage
}

export function getLoopLabel(stage: StageConfig): string {
  if (stage.reviewGate) return "Human Gate"
  if (stage.strategicPhase) return "Strategic + Standard"
  if (stage.tournament) return "Tournament"
  if (stage.agentInnerPlanning) return "Standard + Inner Planning"
  return "Standard"
}
