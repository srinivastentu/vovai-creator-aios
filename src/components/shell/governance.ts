import type { ReviewArtifact } from "@/components/review/artifact-types"
import type { ReviewMaster } from "@/components/review/types"
import { ARTIFACT_TYPE_LABEL } from "@/lib/domain/artifact-labels"
import type { GovernanceApproval, GovernanceRibbonData } from "./types"

// Pure mappers: existing Gate A/B view models → the governance-ribbon data.
// Everything the ribbon shows (score, cost, iterations, lineage, approval) is
// already present on ReviewArtifact / ReviewMaster, so NO new backend read is
// needed — this is frontend shaping only. Kept pure for unit testing.

/** Cross-critique stage pass threshold (CROSS_CRITIQUE_THRESHOLD); both V1 artifact types share it. */
export const STAGE_THRESHOLD = 80

/** Friendly model name from a producer agent id (resilient: unknown ids pass through). */
function friendlyModel(agentId: string): string {
  const id = agentId.toLowerCase()
  if (id.includes("claude")) return "Claude"
  if (id.includes("gpt")) return "GPT-4o"
  if (id.includes("gemini")) return "Gemini"
  return agentId
}

/** Distinct producer models across all iterations, in first-seen order, + the Gemini judge. */
function lineageFromArtifact(artifact: ReviewArtifact): string[] {
  const seen = new Set<string>()
  const lineage: string[] = []
  for (const it of artifact.iterations) {
    for (const p of it.producers) {
      const name = friendlyModel(p.agentId)
      if (!seen.has(name)) {
        seen.add(name)
        lineage.push(name)
      }
    }
  }
  // V1 judge is always Gemini (cross-model, rule 10). Only append when there
  // were graded iterations to describe.
  if (lineage.length > 0) lineage.push("Gemini judge")
  return lineage
}

function artifactApproval(artifact: ReviewArtifact): GovernanceApproval {
  switch (artifact.status) {
    case "approved":
      return "approved"
    case "rejected":
      return "rejected"
    default:
      // draft | awaiting_review — a persisted reviewer note means changes were requested.
      return artifact.reviewFeedback ? "changes_requested" : "in_review"
  }
}

export function governanceFromArtifact(
  artifact: ReviewArtifact,
  opts: { threshold?: number; auditHref?: string } = {},
): GovernanceRibbonData {
  const version = artifact.iterationCount > 0 ? artifact.iterationCount : 1
  return {
    versionLabel: `v${version} · ${ARTIFACT_TYPE_LABEL[artifact.artifactType]}`,
    modelLineage: lineageFromArtifact(artifact),
    score: artifact.bestScore,
    threshold: opts.threshold ?? STAGE_THRESHOLD,
    iterations: artifact.iterationCount > 0 ? artifact.iterationCount : null,
    costUSD: artifact.costUSD,
    approval: artifactApproval(artifact),
    auditHref: opts.auditHref,
    deterministic: false,
  }
}

function masterApproval(master: ReviewMaster): GovernanceApproval {
  switch (master.status) {
    case "approved":
    case "in_repurpose":
      return "approved"
    case "draft":
      return master.reviewFeedback ? "changes_requested" : "in_review"
    default:
      // gate_a_pending
      return "in_review"
  }
}

/**
 * Gate A masters are deterministic (no judge, no cross-critique) — the ribbon
 * shows version + cost-free identity + approval, and hides score/iterations/lineage.
 */
export function governanceFromMaster(master: ReviewMaster): GovernanceRibbonData {
  return {
    versionLabel: "Long-Form Master",
    modelLineage: [],
    score: null,
    threshold: null,
    iterations: null,
    costUSD: 0,
    approval: masterApproval(master),
    deterministic: true,
  }
}
