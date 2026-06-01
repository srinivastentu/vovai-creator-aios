// CreatorOS V1 acceptance test (CR-12).
//
// Runs the canonical BuildOS / Agentic-AI scenario per
// docs/00-foundation/identity-and-scope.md end-to-end with REAL models, auto-
// approving both human gates, and asserts the mechanized acceptance criteria:
//
//   1. The Long-Form Master has ≥ 3 sections, each with ≥ 1 sourceRef.
//   2. (human-judged) The LinkedIn post is publishable without rewrite.
//   3. (human-judged) The article is publishable without rewrite.
//   4. Cross-critique produced substantively different versions across
//      iterations — cosine similarity ≤ 0.92 between consecutive integrated
//      artifacts (REPORTED + WARNED, not a hard gate; see the CR-12 decision /
//      the decisions-log mechanization: "CI assertion only, not a runtime gate").
//   5. Total run cost < $5.00 AND wallclock < 30 min.
//
// Cost note (CR-12 decision): the assertion sums the four per-stage
// `result.totalCostUSD` — the TRUE total — because Stage 2/3 producers + OpenAI
// judges are SDK-direct and bypass the Core CostLedger; the gateway-routed
// ledger subtotal is reported separately for transparency.
//
// Run with: npm run test:acceptance  (needs DATABASE_URL + the three model
// keys in .env.local). Without them the suite SKIPS cleanly, like the DB-gated
// integration suites.
//
// Env load belt-and-suspenders: vitest.e2e.config.ts uses tests/e2e/acceptance-
// setup.ts as a setupFile to load .env.local BEFORE this module is imported;
// the line below is a fallback for a direct `vitest run` of this file.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: ['.env.local', '.env'] })

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { upsertBuildOsScenario, BUILDOS_IDS } from '../../prisma/fixtures/buildos'
import { runFullPipeline, type PipelineRunResult } from './helpers/pipeline-runner'
import {
  stageSimilarityReport,
  formatSimilarityReport,
  type StageSimilarityReport,
} from './helpers/embedding-distance'

const COST_CEILING_USD = 5.0
const WALLCLOCK_CEILING_MS = 30 * 60_000
const TEST_TIMEOUT_MS = 40 * 60_000

const hasEnv = Boolean(
  process.env.DATABASE_URL &&
    process.env.ANTHROPIC_API_KEY &&
    process.env.OPENAI_API_KEY &&
    process.env.GOOGLE_GEMINI_API_KEY,
)
const suite = hasEnv ? describe : describe.skip

if (!hasEnv) {
  // eslint-disable-next-line no-console
  console.warn(
    '[v1-acceptance] SKIPPED — needs DATABASE_URL + ANTHROPIC_API_KEY + OPENAI_API_KEY + GOOGLE_GEMINI_API_KEY in .env.local',
  )
}

suite('CreatorOS V1 acceptance — BuildOS / Agentic AI', () => {
  let db: PrismaClient

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    db = new PrismaClient({ adapter })
    // Ensure the canonical scenario exists and start from a clean idea status.
    await upsertBuildOsScenario(db)
    await db.idea.update({
      where: { id: BUILDOS_IDS.ideaId },
      data: { status: 'captured' },
    })
  })

  afterAll(async () => {
    await db?.$disconnect()
  })

  it(
    'produces a traceable LFM + 1 publishable LinkedIn post + 1 article, under budget',
    async () => {
      const startedAt = Date.now()
      const result = await runFullPipeline(db, BUILDOS_IDS.ideaId, {
        // eslint-disable-next-line no-console
        onLog: (m) => console.log(`[acceptance] ${m}`),
      })
      const wallclockMs = Date.now() - startedAt

      // Cosine similarity (criterion 4) — reported + warned, NOT a hard gate.
      const linkedinSim = await stageSimilarityReport('LinkedIn', result.linkedin.integratedTexts)
      const articleSim = await stageSimilarityReport('Article', result.article.integratedTexts)

      // Verify Gate B actually flipped both artifacts to approved.
      const persistedArtifacts = await db.artifact.findMany({
        where: { id: { in: [result.linkedin.artifactId, result.article.artifactId] } },
        select: { id: true, artifactType: true, status: true },
      })
      const idea = await db.idea.findUniqueOrThrow({ where: { id: result.ideaId } })

      writeRunOutput(result, { wallclockMs, linkedinSim, articleSim, ideaStatus: idea.status })
      logSummary(result, { wallclockMs, linkedinSim, articleSim })

      // ── Criterion 1: traceable Long-Form Master ──────────────────────────────
      expect(result.research.sourceCount).toBeGreaterThanOrEqual(3)
      expect(result.master.sectionCount).toBeGreaterThanOrEqual(3)
      expect(result.master.everySectionHasSource).toBe(true)

      // ── Criteria 2 & 3 (mechanized portion): both artifacts produced + valid +
      //    approved. Publishability is human-judged from the written output.
      expect(result.linkedin.artifact.charCount).toBeGreaterThan(0)
      expect(result.article.artifact.wordCount).toBeGreaterThan(0)
      expect(persistedArtifacts).toHaveLength(2)
      expect(persistedArtifacts.every((a) => a.status === 'approved')).toBe(true)
      expect(result.ideaCompleted).toBe(true)
      expect(idea.status).toBe('completed')

      // ── Criterion 5: cost + wallclock budgets ────────────────────────────────
      expect(result.totalCostUSD).toBeLessThan(COST_CEILING_USD)
      expect(wallclockMs).toBeLessThan(WALLCLOCK_CEILING_MS)

      // Criterion 4 is advisory: surface a warning when iterations converged, but
      // never fail the run on it (decisions-log: warning, not failure).
      if (!linkedinSim.withinCeiling || !articleSim.withinCeiling) {
        // eslint-disable-next-line no-console
        console.warn(
          `[acceptance] ⚠️ cosine-similarity advisory exceeded for: ` +
            [
              linkedinSim.withinCeiling ? null : 'LinkedIn',
              articleSim.withinCeiling ? null : 'Article',
            ]
              .filter(Boolean)
              .join(', ') +
            ' — iterations converged (tuning signal, not a failure).',
        )
      }
    },
    TEST_TIMEOUT_MS,
  )
})

interface RunMeta {
  wallclockMs: number
  linkedinSim: StageSimilarityReport
  articleSim: StageSimilarityReport
  ideaStatus?: string
}

function writeRunOutput(result: PipelineRunResult, meta: RunMeta): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = resolve(process.cwd(), 'tests', 'e2e', 'output', `acceptance-run-${stamp}`)
  mkdirSync(dir, { recursive: true })

  writeFileSync(join(dir, 'linkedin_post.txt'), result.linkedin.artifact.text, 'utf8')
  writeFileSync(join(dir, 'long_form_article.md'), result.article.artifact.markdown, 'utf8')

  const summary = {
    scenario: 'BuildOS Creator — Agentic AI',
    ideaId: result.ideaId,
    masterId: result.masterId,
    ideaStatus: meta.ideaStatus,
    ideaCompleted: result.ideaCompleted,
    criteria: {
      c1_traceable_master: {
        researchSources: result.research.sourceCount,
        sectionCount: result.master.sectionCount,
        everySectionHasSource: result.master.everySectionHasSource,
        wordCount: result.master.wordCount,
        sections: result.master.sections,
        pass:
          result.research.sourceCount >= 3 &&
          result.master.sectionCount >= 3 &&
          result.master.everySectionHasSource,
      },
      c4_cosine_advisory: {
        linkedin: meta.linkedinSim,
        article: meta.articleSim,
        note: 'warning, not a hard gate (decisions-log mechanization)',
      },
      c5_budgets: {
        totalCostUSD: round4(result.totalCostUSD),
        ledgerTotalUSD: round4(result.ledgerTotalUSD),
        costCeilingUSD: COST_CEILING_USD,
        costPass: result.totalCostUSD < COST_CEILING_USD,
        wallclockMs: meta.wallclockMs,
        wallclockMin: round2(meta.wallclockMs / 60_000),
        wallclockCeilingMin: WALLCLOCK_CEILING_MS / 60_000,
        wallclockPass: meta.wallclockMs < WALLCLOCK_CEILING_MS,
      },
    },
    costBreakdownUSD: {
      research: round4(result.research.totalCostUSD),
      master: round4(result.master.totalCostUSD),
      linkedin: round4(result.linkedin.totalCostUSD),
      article: round4(result.article.totalCostUSD),
      total: round4(result.totalCostUSD),
      ledgerSubtotal: round4(result.ledgerTotalUSD),
    },
    scores: {
      research: result.research.bestScore,
      master: result.master.bestScore,
      linkedin: result.linkedin.bestScore,
      article: result.article.bestScore,
    },
    artifacts: {
      linkedin: { id: result.linkedin.artifactId, charCount: result.linkedin.artifact.charCount, iterations: result.linkedin.iterationCount, terminationReason: result.linkedin.terminationReason },
      article: { id: result.article.artifactId, wordCount: result.article.artifact.wordCount, iterations: result.article.iterationCount, terminationReason: result.article.terminationReason },
    },
  }
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  writeFileSync(
    join(dir, 'README.md'),
    [
      '# CreatorOS V1 acceptance run',
      '',
      'Criteria 2 & 3 are **human-judged**: read the two artifacts below and confirm',
      'each is publishable without rewrite.',
      '',
      `- LinkedIn post: \`linkedin_post.txt\` (${result.linkedin.artifact.charCount} chars)`,
      `- Article: \`long_form_article.md\` (${result.article.artifact.wordCount} words)`,
      `- Full mechanized summary: \`summary.json\``,
      '',
      `Total cost: $${round4(result.totalCostUSD)} (ceiling $${COST_CEILING_USD}).`,
      `Wallclock: ${round2(meta.wallclockMs / 60_000)} min (ceiling 30 min).`,
      '',
      `LinkedIn similarity: ${formatSimilarityReport(meta.linkedinSim)}`,
      `Article similarity: ${formatSimilarityReport(meta.articleSim)}`,
    ].join('\n'),
    'utf8',
  )

  // eslint-disable-next-line no-console
  console.log(`[acceptance] artifacts written to ${dir}`)
}

function logSummary(result: PipelineRunResult, meta: RunMeta): void {
  /* eslint-disable no-console */
  console.log('\n=== V1 ACCEPTANCE SUMMARY ===')
  console.log(
    `Master: ${result.master.sectionCount} sections, ${result.master.wordCount} words, ` +
      `everySectionHasSource=${result.master.everySectionHasSource} (score ${result.master.bestScore ?? 'n/a'})`,
  )
  console.log(
    `LinkedIn: ${result.linkedin.artifact.charCount} chars, score ${result.linkedin.bestScore ?? 'n/a'}, ` +
      `${result.linkedin.iterationCount} iters`,
  )
  console.log(
    `Article: ${result.article.artifact.wordCount} words, score ${result.article.bestScore ?? 'n/a'}, ` +
      `${result.article.iterationCount} iters`,
  )
  console.log(
    `Cost — research $${round4(result.research.totalCostUSD)} + master $${round4(result.master.totalCostUSD)} + ` +
      `linkedin $${round4(result.linkedin.totalCostUSD)} + article $${round4(result.article.totalCostUSD)} ` +
      `= $${round4(result.totalCostUSD)} (ledger subtotal $${round4(result.ledgerTotalUSD)})`,
  )
  console.log(`Wallclock: ${round2(meta.wallclockMs / 60_000)} min`)
  console.log(formatSimilarityReport(meta.linkedinSim))
  console.log(formatSimilarityReport(meta.articleSim))
  console.log(`Idea completed: ${result.ideaCompleted}`)
  console.log('=============================\n')
  /* eslint-enable no-console */
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
