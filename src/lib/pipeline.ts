/**
 * Pipeline stage definitions — loaded from config (Level 2).
 *
 * The engine (Level 1) provides getStage/getLoopLabel utilities.
 * The product config (Level 2) defines what stages exist and how they're wired.
 * Adding Film AIOS = new JSON config file, not new engine code.
 */
import type { StageConfig } from "./types"
import pipelineConfig from "@config/pipelines/elearn-aios-pipeline.json"

export const STAGES: StageConfig[] = pipelineConfig.stages as StageConfig[]

export const RINGS = pipelineConfig.rings as readonly {
  ring: number
  label: string
  stages: number[]
}[]

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
