// Stage-5 (Repurpose) persistence mappers — Gate B (CR-11) support.
//
// Pure functions that turn a finished cross-critique run + human edits into the
// shapes the data layer / CLI write via Prisma. No Prisma, no I/O here (the data
// layer applies them) so every mapping is unit-testable in isolation — mirroring
// single-producer-stage.ts's buildArtifactPersistence.
//
// Homes:
//   - buildIterationHistoryRows: CrossCritiqueIterationRecord[] → IterationRecord
//     rows (the Gate B history panel's persisted source).
//   - rebuildArtifactContent: a human-edited body → Artifact.content (+ re-validate),
//     recomputing counts by code (never trusting the client).
//   - bothArtifactTypesApproved: the Idea-completion condition.
//   - editForkSpec / regenForkSpec: the fork-on-regenerate lineage (Immutable
//     History — derivedVia + parentArtifactIds, per the decisions log).

import type { ArtifactStatus } from "@/generated/prisma/client"
import type { CrossCritiqueIterationRecord, GradeReport, ValidationResult } from "../../../core/engine/types"
import { validateLinkedInPost } from "./validators/linkedin-post-validator"
import { validateArticle, articleWordCount } from "./validators/article-validator"
import type {
  ArticleArtifact,
  ArtifactKind,
  LinkedInArtifact,
  RepurposeArtifact,
} from "./types"

// ─── Iteration-history mapping (cross-critique → IterationRecord rows) ──────────

/** The cross-critique per-iteration detail stored in IterationRecord.detailJson. */
export interface IterationDetail {
  /** producerAgentId → trimmed snippet + the producer's size (chars/words). */
  producers: { agentId: string; snippet: string; size: number }[]
  /** criticAgentId → trimmed critique snippet. */
  critiques: { criticId: string; snippet: string }[]
  /** The integrator's synthesized output snippet; null on graceful degradation. */
  integratorSnippet: string | null
  /** True when the judge was skipped (integration unusable / validator rejected). */
  judgeSkipped: boolean
  /** How many producers returned a usable artifact (< producers.length = degraded). */
  producersSucceeded: number
}

/** One IterationRecord row payload (the data layer adds stageSessionId). */
export interface IterationHistoryRow {
  version: number
  gradeJson: GradeReport | null
  detailJson: IterationDetail
  modelUsed: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

const DEFAULT_SNIPPET_CHARS = 320

/** Collapse whitespace and clip a snippet to a panel-friendly length. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`
}

/**
 * Map the cross-critique iteration records into IterationRecord row payloads.
 * `preview` turns a (typed) artifact into its display text + size; `integratorModel`
 * is the model that produced each judged artifact (the row's modelUsed). tokens are
 * passed through (cross-critique records carry 0 — cost is the per-iteration signal).
 */
export function buildIterationHistoryRows<T>(
  records: CrossCritiqueIterationRecord[],
  preview: (artifact: T) => { text: string; size: number },
  integratorModel: string,
  snippetChars: number = DEFAULT_SNIPPET_CHARS,
): IterationHistoryRow[] {
  return records.map((rec) => {
    const integrated = (rec.integratedArtifact as T | null) ?? null
    return {
      version: rec.version,
      gradeJson: rec.judgeGrade,
      modelUsed: integratorModel,
      tokensIn: rec.tokensIn,
      tokensOut: rec.tokensOut,
      costUSD: rec.iterationCostUSD,
      detailJson: {
        producers: Object.entries(rec.producerArtifacts).map(([agentId, a]) => {
          const p = preview(a as T)
          return { agentId, snippet: clip(p.text, snippetChars), size: p.size }
        }),
        critiques: Object.entries(rec.critiques).map(([criticId, c]) => ({
          criticId,
          snippet: clip(c, snippetChars),
        })),
        integratorSnippet: integrated ? clip(preview(integrated).text, snippetChars) : null,
        judgeSkipped: rec.judgeGrade === null,
        producersSucceeded: rec.producersSucceeded,
      },
    }
  })
}

// ─── Content rebuild + re-validate (inline edit) ────────────────────────────────

export interface RebuildResult {
  content: RepurposeArtifact
  validation: ValidationResult
}

/** First markdown H1 (`# Title`) text, or null. Re-derives an edited article's title. */
function extractTitle(markdown: string): string | null {
  for (const line of markdown.split("\n")) {
    const m = /^#[ \t]+(.+)$/.exec(line.trim())
    if (m) return m[1].trim()
  }
  return null
}

/**
 * Reconstruct an Artifact.content from a human-edited body and re-run the
 * deterministic validator. Counts (charCount / wordCount) are recomputed by code —
 * never trusted from the client — exactly as the producers compute them, so an
 * edited artifact is held to the same publishable bounds the loop enforced.
 * For an article the title is re-derived from the body's H1 (fallback supplied).
 */
export function rebuildArtifactContent(
  type: ArtifactKind,
  editedBody: string,
  fallbackTitle: string,
): RebuildResult {
  if (type === "linkedin_post") {
    const text = editedBody.trim()
    const content: LinkedInArtifact = { text, charCount: text.length }
    return { content, validation: validateLinkedInPost(content) }
  }
  const markdown = editedBody.trimEnd()
  const content: ArticleArtifact = {
    title: extractTitle(markdown) ?? fallbackTitle,
    markdown,
    wordCount: articleWordCount(markdown),
  }
  return { content, validation: validateArticle(content) }
}

// ─── Idea-completion condition ──────────────────────────────────────────────────

/** The V1 repurpose targets. Idea completion requires an approved artifact of each. */
export const V1_ARTIFACT_TYPES: readonly ArtifactKind[] = [
  "linkedin_post",
  "long_form_article",
] as const

/**
 * True iff every V1 artifact type has at least one approved artifact among the
 * master's artifacts — the condition for marking the source Idea 'completed'
 * (pipeline-v1 Stage 5: "When BOTH artifacts approved → Idea completed"). If the
 * user only produced one type, the Idea does not auto-complete (acceptable for V1;
 * they can mark it complete manually). `status` is the Prisma `ArtifactStatus`
 * (type-only import — no runtime coupling) so the union stays exhaustive.
 */
export function bothArtifactTypesApproved(
  artifacts: { artifactType: ArtifactKind; status: ArtifactStatus }[],
): boolean {
  return V1_ARTIFACT_TYPES.every((t) =>
    artifacts.some((a) => a.artifactType === t && a.status === "approved"),
  )
}

// ─── Fork-on-regenerate lineage (Immutable History) ─────────────────────────────

/** A new Artifact's lineage fields (the data layer supplies content/score/cost). */
export interface ForkSpec {
  derivedVia: "inline_edit" | "regenerate"
  parentArtifactIds: string[]
  /** The forked row's initial status. */
  status: "draft" | "awaiting_review"
}

/**
 * The A_edited fork: the human's edited body captured as a new Artifact parented to
 * the artifact they edited. derivedVia='inline_edit'; status='draft' — it is a seed
 * for regeneration (priority context), not a reviewed final. (decisions log:
 * "Inline-edit + Regenerate resolves as FORK, not discard or merge.")
 */
export function editForkSpec(editedFromArtifactId: string): ForkSpec {
  return {
    derivedVia: "inline_edit",
    parentArtifactIds: [editedFromArtifactId],
    status: "draft",
  }
}

/**
 * The A_regen fork: the regenerated artifact, parented to the A_edited seed.
 * derivedVia='regenerate'; status='awaiting_review' (it re-enters Gate B).
 */
export function regenForkSpec(editForkArtifactId: string): ForkSpec {
  return {
    derivedVia: "regenerate",
    parentArtifactIds: [editForkArtifactId],
    status: "awaiting_review",
  }
}
