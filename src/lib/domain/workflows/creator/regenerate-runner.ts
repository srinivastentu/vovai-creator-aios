// Gate B regenerate runner (CR-11) — runs a fresh cross-critique loop for the
// fork-on-regenerate flow and maps it to the rows the data layer persists.
//
// The `RegenRunner` seam lets the data layer inject a fake (tests / no API keys);
// `liveRegenRunner` is the default — it builds the per-type cross-critique stage,
// runs the loop to a terminal state (producers read context.priorEditText as
// priority context), and returns the best artifact + the iteration-history rows.
//
// All Core machinery is reached through cross-critique-stage.ts (which injects it);
// this module imports Domain + Core types only. No Prisma, no I/O — the data layer
// (artifact-actions.ts) owns persistence and the API-key gate.

import type { CrossCritiqueIterationRecord } from "../../../core/engine/types"
import {
  createArticleCrossCritiqueStage,
  createLinkedInCrossCritiqueStage,
  runCrossCritiqueLoop,
  type CrossCritiqueStage,
} from "./cross-critique-stage"
import { buildIterationHistoryRows, type IterationHistoryRow } from "./repurpose-persistence"
import type { ArtifactKind, RepurposeArtifact, RepurposeContext } from "./types"

export interface RegenInput {
  /** RepurposeContext incl. `priorEditText` (the human-edited prior version). */
  context: RepurposeContext
  type: ArtifactKind
  /** Persona block the Gemini judge grades persona/audience fit against. */
  personaContext: string
}

export interface RegenOutcome {
  stageId: string
  best: RepurposeArtifact | null
  bestScore: number | null
  totalCostUSD: number
  terminationReason: string | null
  /** IterationRecord row payloads for the regen run's StageSession. */
  historyRows: IterationHistoryRow[]
}

export type RegenRunner = (input: RegenInput) => Promise<RegenOutcome>

async function runStage<T extends RepurposeArtifact>(
  stage: CrossCritiqueStage<T>,
  context: RepurposeContext,
): Promise<RegenOutcome> {
  const result = await runCrossCritiqueLoop<T>({ stage, context })
  // The loop pushes CrossCritiqueIterationRecords; they slot into LoopState as
  // IterationRecord. Narrow back to read the per-role sub-artifacts for the panel.
  const records = result.iterations as CrossCritiqueIterationRecord[]
  const integratorModel = stage.stage.crossCritique?.integratorAgent.model.primary ?? stage.stage.id
  return {
    stageId: stage.stage.id,
    best: result.bestArtifact,
    bestScore: result.bestScore,
    totalCostUSD: result.totalCostUSD,
    terminationReason: result.terminationReason ?? null,
    historyRows: buildIterationHistoryRows<T>(records, stage.preview, integratorModel),
  }
}

/** The production runner: a real cross-critique loop via the MMS gateway. */
export const liveRegenRunner: RegenRunner = async ({ context, type, personaContext }) =>
  type === "linkedin_post"
    ? runStage(createLinkedInCrossCritiqueStage({ personaContext }), context)
    : runStage(createArticleCrossCritiqueStage({ personaContext }), context)
