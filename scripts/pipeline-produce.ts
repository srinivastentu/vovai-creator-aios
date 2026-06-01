#!/usr/bin/env tsx
// CR-7 — Stage 5 (Repurpose) Cross-Critique CLI runner.
// Usage:
//   npm run pipeline:produce -- --longFormMasterId=<id> --type=linkedin_post
//   npm run pipeline:produce -- --longFormMasterId=<id> --type=long_form_article
//
// Loads a Long-Form Master (its ordered sections) plus the Idea + Workspace +
// CreatorPersona, runs the CROSS-CRITIQUE loop (Pattern 5) to completion: two
// producers (Claude + GPT-4o) → two cross-model critics → Claude integrator →
// Gemini judge, repeating until threshold / budget / max iterations. It then
// persists an Artifact row (derivedVia='cross_critique', the judge's best
// composite as bestScore), writes the rendered output to tmp/runs/<ideaId>/
// <type>.md, prints the full iteration history, and reports the cosine similarity
// between consecutive integrated artifacts (acceptance check: ≤ 0.92).
//
// CR-7 needs ANTHROPIC_API_KEY (Claude producer/critic/integrator) +
// OPENAI_API_KEY (GPT-4o producer/critic + embeddings) + GOOGLE_GEMINI_API_KEY
// (Gemini judge). All route through the MMS gateway. Load .env.local first
// (canonical local secrets) then .env — earlier files win (Next.js precedence).
import { config as loadEnv } from 'dotenv'
loadEnv({ path: ['.env.local', '.env'] })
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient, Prisma } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  createLinkedInCrossCritiqueStage,
  createArticleCrossCritiqueStage,
  runCrossCritiqueLoop,
  type CrossCritiqueIterationEvent,
} from '../src/lib/domain/workflows/creator/cross-critique-stage'
import { buildArtifactPersistence } from '../src/lib/domain/workflows/creator/single-producer-stage'
import type {
  ArtifactKind,
  ArticleArtifact,
  LinkedInArtifact,
  ProducerPersona,
  RepurposeArtifact,
  RepurposeContext,
} from '../src/lib/domain/workflows/creator/types'
import { consecutiveSimilarities } from './lib/embedding-similarity'

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

const ARTIFACT_KINDS: ArtifactKind[] = ['linkedin_post', 'long_form_article']
function isArtifactKind(v: string | undefined): v is ArtifactKind {
  return v !== undefined && (ARTIFACT_KINDS as string[]).includes(v)
}

function toProducerPersona(persona: {
  name: string
  voiceTone: unknown
  audienceProfile: unknown
  creatorProfile: unknown
}): ProducerPersona {
  const voice = asRecord(persona.voiceTone)
  const audience = asRecord(persona.audienceProfile)
  const creator = asRecord(persona.creatorProfile)
  return {
    name: persona.name,
    voiceSummary: [str(voice.formality), str(voice.vocabulary), str(voice.sentenceRhythm)]
      .filter(Boolean)
      .join(' '),
    pointOfView: str(creator.pointOfView),
    audienceSummary: [
      str(audience.primaryRole),
      str(audience.experienceLevel),
      str(audience.whatTheyWant),
    ]
      .filter(Boolean)
      .join(' — '),
    signaturePhrases: strArr(voice.signaturePhrases),
    signatureHooks: strArr(creator.signatureHooks),
    doNotSay: strArr(voice.doNotSay),
  }
}

/** Persona block the Gemini judge grades personaFit / audienceFit against. */
function renderPersonaContext(p: ProducerPersona): string {
  return [
    `Name: ${p.name}`,
    p.voiceSummary ? `Voice: ${p.voiceSummary}` : '',
    p.pointOfView ? `Point of view: ${p.pointOfView}` : '',
    p.audienceSummary ? `Audience: ${p.audienceSummary}` : '',
    p.doNotSay.length ? `Never say: ${p.doNotSay.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function renderOutput(type: ArtifactKind, artifact: RepurposeArtifact): string {
  if (type === 'linkedin_post') return (artifact as LinkedInArtifact).text
  return (artifact as ArticleArtifact).markdown
}

function sizeLabel(type: ArtifactKind, artifact: RepurposeArtifact): string {
  if (type === 'linkedin_post') return `${(artifact as LinkedInArtifact).charCount} chars`
  return `${(artifact as ArticleArtifact).wordCount} words`
}

/** Collapse whitespace/newlines so a snippet prints on one console line. */
function truncate(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

async function main() {
  const longFormMasterId = parseArg('longFormMasterId')
  const type = parseArg('type')
  if (!longFormMasterId || !isArtifactKind(type)) {
    console.error(
      'Usage: npm run pipeline:produce -- --longFormMasterId=<id> --type=linkedin_post|long_form_article'
    )
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY must be set (Claude producer/critic/integrator).')
    process.exit(1)
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY must be set (GPT-4o producer/critic + embeddings).')
    process.exit(1)
  }
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('GOOGLE_GEMINI_API_KEY must be set (cross-model Gemini judge).')
    process.exit(1)
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const db = new PrismaClient({ adapter })

  try {
    const master = await db.longFormMaster.findUnique({
      where: { id: longFormMasterId },
      include: {
        sections: { orderBy: { order: 'asc' } },
        idea: true,
        workspace: { include: { persona: true } },
      },
    })
    if (!master) throw new Error(`LongFormMaster not found: ${longFormMasterId}`)
    if (master.sections.length === 0) {
      throw new Error(
        `LongFormMaster ${longFormMasterId} has no sections — run pipeline:master first.`
      )
    }

    const persona = toProducerPersona(master.workspace.persona)
    const context: RepurposeContext = {
      longFormMasterId: master.id,
      artifactType: type,
      masterTitle: master.title,
      ideaTitle: master.idea.title,
      niches: master.idea.niches,
      persona,
      sections: master.sections.map((s) => ({
        heading: s.heading,
        contentMarkdown: s.contentMarkdown,
      })),
    }

    console.log(`\n=== STAGE 5 (REPURPOSE — CROSS-CRITIQUE) — ${type} — "${master.idea.title}" ===`)
    console.log(
      `Persona: ${persona.name}  |  Workspace: ${master.workspace.name}  |  ${master.sections.length} master sections`
    )
    console.log(
      'Producers: Claude + GPT-4o  |  Critics: cross-model  |  Integrator: Claude  |  Judge: Gemini\n'
    )

    const personaContext = renderPersonaContext(persona)

    const onIteration = (e: CrossCritiqueIterationEvent) => {
      console.log(`── Iteration ${e.version} ${'─'.repeat(40)}`)
      for (const p of e.producers) {
        console.log(`  [producer ${p.agentId}] (${p.size}) ${truncate(p.snippet)}`)
      }
      for (const c of e.critiques) {
        console.log(`  [critic ${c.criticId}] ${truncate(c.snippet)}`)
      }
      if (e.integratorSnippet !== null) {
        console.log(`  [integrator] ${truncate(e.integratorSnippet)}`)
      }
      if (e.judgeSkipped) {
        console.log('  [judge] skipped (integration unusable or validator rejected) — revising.')
      } else {
        const dims = e.dimensionScores.map((d) => `${d.name} ${d.score}`).join(', ')
        console.log(`  [judge] score ${e.score}/100${dims ? ` — ${dims}` : ''}`)
      }
      console.log(`  iteration cost: $${e.iterationCostUSD.toFixed(4)}\n`)
    }

    // Branch on artifact type — each stage carries a distinct artifact T. The
    // stage routes all 6 sub-calls per iteration through the MMS gateway; the
    // Gemini judge grades against personaContext. result.totalCostUSD is the
    // engine's cumulativeCostUSD (producers + critics + integrator + judge).
    const result =
      type === 'linkedin_post'
        ? await runCrossCritiqueLoop({
            stage: createLinkedInCrossCritiqueStage({ personaContext }),
            context,
            onIteration,
          })
        : await runCrossCritiqueLoop({
            stage: createArticleCrossCritiqueStage({ personaContext }),
            context,
            onIteration,
          })

    const best = result.bestArtifact as RepurposeArtifact | null
    if (!best) {
      throw new Error(
        `Cross-critique loop produced no usable ${type}` +
          (result.error ? ` (${result.error.message})` : '')
      )
    }

    // Auto-present (dev): persist the Artifact row. derivedVia='cross_critique' is
    // now literally true (CR-7); bestScore is the Gemini judge's best composite.
    const payload = buildArtifactPersistence(type, best, result.totalCostUSD, result.bestScore)
    const saved = await db.artifact.create({
      data: {
        workspaceId: master.workspaceId,
        longFormMasterId: master.id,
        artifactType: payload.artifactType,
        // RepurposeArtifact is a declared interface (no index signature), so it
        // is not structurally an InputJsonValue — narrow through unknown. The
        // runtime value is plain JSON (string/number fields only).
        content: payload.content as unknown as Prisma.InputJsonValue,
        parentArtifactIds: payload.parentArtifactIds,
        derivedVia: payload.derivedVia,
        bestScore: payload.bestScore,
        status: payload.status,
        costUSD: payload.costUSD,
      },
    })

    const outDir = resolve(process.cwd(), 'tmp', 'runs', master.ideaId)
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, `${type}.md`)
    writeFileSync(outPath, renderOutput(type, best), 'utf8')

    const scoreLabel = result.bestScore !== null ? `${result.bestScore}/100` : 'n/a'
    console.log(
      `Generated ${type} at ${outPath}. ${sizeLabel(type, best)}. ` +
        `Best score: ${scoreLabel} over ${result.iterations.length} iteration(s). ` +
        `Cost: $${result.totalCostUSD.toFixed(4)}. Termination: ${result.terminationReason ?? 'n/a'}.`
    )
    console.log(
      `Artifact ${saved.id} → status=${saved.status}, derivedVia=${saved.derivedVia}, bestScore=${saved.bestScore ?? 'null'}.`
    )
    const verdict = result.finalState.bestGrade?.recommendation
    if (verdict) console.log(`Judge verdict: ${verdict}`)
    if (result.error) {
      console.log(
        `(loop surfaced an error at iteration ${result.error.iteration}: ${result.error.message})`
      )
    }

    // Acceptance check (decisions log): cosine similarity between consecutive
    // integrated artifacts must be ≤ 0.92 — higher means producers are stuck.
    // A warning, not a gate.
    const integratedTexts = result.integratedArtifacts.map((a) =>
      type === 'linkedin_post' ? (a as LinkedInArtifact).text : (a as ArticleArtifact).markdown
    )
    if (integratedTexts.length >= 2) {
      try {
        const sims = await consecutiveSimilarities(integratedTexts)
        const label = sims.map((s, i) => `v${i + 1}→v${i + 2}: ${s.toFixed(3)}`).join(', ')
        const maxSim = Math.max(...sims)
        console.log(`Cross-critique similarity (text-embedding-3-large): ${label}`)
        if (maxSim > 0.92) {
          console.log(
            `⚠️  similarity ${maxSim.toFixed(3)} > 0.92 — iterations may be superficial (tuning signal).`
          )
        } else {
          console.log(`✓ all consecutive similarities ≤ 0.92 (substantively different iterations).`)
        }
      } catch (err) {
        console.log(`(similarity check skipped: ${err instanceof Error ? err.message : String(err)})`)
      }
    } else {
      console.log(`(similarity check needs ≥2 integrated artifacts; got ${integratedTexts.length}.)`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
