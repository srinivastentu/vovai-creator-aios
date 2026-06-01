// Embedding-distance helper for the V1 acceptance test (CR-12).
//
// Mechanizes acceptance criterion 4 (identity-and-scope.md): the cross-critique
// loop produced "substantively different" versions across iterations — checked
// as cosine similarity ≤ 0.92 between consecutive integrated artifacts, via
// text-embedding-3-large.
//
// "via MMS" reinterpretation (CR-12 decision): the MMS gateway has NO embedding
// capability wired (the 'embedding' capability literal exists in
// core/models/types.ts but has no provider handler, no catalog model, and no
// result channel). Adding one is net-new Core machinery unjustified by a
// CI-only similarity check (a warning, not a runtime gate — see the decisions
// log). So embeddings call the OpenAI SDK directly, exactly as the CR-7 helper
// scripts/lib/embedding-similarity.ts already does. This module re-exports that
// canonical math (single source of truth) and adds an acceptance-test report
// formatter on top.
export {
  EMBEDDING_MODEL,
  cosineSimilarity,
  embedTexts,
  consecutiveSimilarities,
  type EmbedFn,
  type SimilarityOpts,
} from '../../../scripts/lib/embedding-similarity'

import { consecutiveSimilarities, type SimilarityOpts } from '../../../scripts/lib/embedding-similarity'

/** The advisory similarity ceiling from the acceptance test (≤ 0.92). */
export const SIMILARITY_CEILING = 0.92

export interface StageSimilarityReport {
  stage: string
  /** Cosine similarity for each consecutive integrated-artifact pair. */
  similarities: number[]
  /** Max consecutive similarity, or null when < 2 integrated artifacts. */
  maxSimilarity: number | null
  /** True when every consecutive pair is ≤ {@link SIMILARITY_CEILING}. */
  withinCeiling: boolean
  /** True when there were < 2 integrated artifacts to compare. */
  insufficientData: boolean
}

/**
 * Compute the consecutive cosine-similarity report for one cross-critique
 * stage's ordered integrated artifacts. Per the decisions log this is a
 * WARNING signal, not a hard gate: `withinCeiling === false` flags that the
 * iterations converged (a tuning opportunity), it does not fail the run.
 */
export async function stageSimilarityReport(
  stage: string,
  integratedTexts: string[],
  opts: SimilarityOpts = {},
): Promise<StageSimilarityReport> {
  const similarities = await consecutiveSimilarities(integratedTexts, opts)
  if (similarities.length === 0) {
    return {
      stage,
      similarities,
      maxSimilarity: null,
      withinCeiling: true,
      insufficientData: true,
    }
  }
  const maxSimilarity = Math.max(...similarities)
  return {
    stage,
    similarities,
    maxSimilarity,
    withinCeiling: maxSimilarity <= SIMILARITY_CEILING,
    insufficientData: false,
  }
}

/** One-line human-readable summary of a {@link StageSimilarityReport}. */
export function formatSimilarityReport(report: StageSimilarityReport): string {
  if (report.insufficientData) {
    return `${report.stage}: similarity check needs ≥2 integrated artifacts (got < 2) — n/a`
  }
  const pairs = report.similarities
    .map((s, i) => `v${i + 1}→v${i + 2}: ${s.toFixed(3)}`)
    .join(', ')
  const verdict = report.withinCeiling
    ? `✓ ≤ ${SIMILARITY_CEILING} (substantively different iterations)`
    : `⚠️  max ${report.maxSimilarity?.toFixed(3)} > ${SIMILARITY_CEILING} (iterations converged — tuning signal, not a failure)`
  return `${report.stage}: ${pairs} — ${verdict}`
}
