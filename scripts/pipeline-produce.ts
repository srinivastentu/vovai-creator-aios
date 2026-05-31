#!/usr/bin/env tsx
// CR-4 — Stage 5 (Repurpose) single-model producer CLI runner.
// Usage:
//   npm run pipeline:produce -- --longFormMasterId=<id> --type=linkedin_post
//   npm run pipeline:produce -- --longFormMasterId=<id> --type=long_form_article
//
// Loads a Long-Form Master (its ordered sections) plus the Idea + Workspace +
// CreatorPersona, runs the single-producer loop to completion (auto-presented —
// Gate B UI arrives in CR-11), persists an Artifact row, and writes the rendered
// output to tmp/runs/<ideaId>/<type>.md.
//
// CR-4 needs only ANTHROPIC_API_KEY (one Claude producer; no judge until CR-5).
// Load .env.local first (canonical local secrets) then .env — earlier files
// win, matching Next.js precedence. dotenv/config alone only reads .env.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: ['.env.local', '.env'] })
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient, Prisma } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  createLinkedInStage,
  createArticleStage,
  runProducerLoop,
  buildArtifactPersistence,
} from '../src/lib/domain/workflows/creator/single-producer-stage'
import type {
  ArtifactKind,
  ArticleArtifact,
  LinkedInArtifact,
  ProducerPersona,
  RepurposeArtifact,
  RepurposeContext,
} from '../src/lib/domain/workflows/creator/types'

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

function renderOutput(type: ArtifactKind, artifact: RepurposeArtifact): string {
  if (type === 'linkedin_post') return (artifact as LinkedInArtifact).text
  return (artifact as ArticleArtifact).markdown
}

function sizeLabel(type: ArtifactKind, artifact: RepurposeArtifact): string {
  if (type === 'linkedin_post') return `${(artifact as LinkedInArtifact).charCount} chars`
  return `${(artifact as ArticleArtifact).wordCount} words`
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
    console.error('ANTHROPIC_API_KEY must be set.')
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

    console.log(`\n=== STAGE 5 (REPURPOSE) — ${type} — "${master.idea.title}" ===`)
    console.log(
      `Persona: ${persona.name}  |  Workspace: ${master.workspace.name}  |  ${master.sections.length} master sections\n`
    )

    const onIteration = (e: { version: number; score: number; validationFailed: boolean }) => {
      if (e.validationFailed) {
        console.log(`v${e.version}: VALIDATION FAILED — revising.`)
        return
      }
      console.log(`Iteration ${e.version}: structural pass (score ${e.score}/100).`)
    }

    // Branch on artifact type — each stage carries a distinct artifact T.
    const result =
      type === 'linkedin_post'
        ? await runProducerLoop({ stage: createLinkedInStage(), context, onIteration })
        : await runProducerLoop({ stage: createArticleStage(), context, onIteration })

    const best = result.bestArtifact as RepurposeArtifact | null
    if (!best) throw new Error(`Producer loop produced no usable ${type}`)

    // Auto-present (dev): persist the Artifact row. bestScore stays null — CR-4
    // has no LLM quality judge (CR-5 fills it). TODO(CR-9): cost → StageSession.
    const payload = buildArtifactPersistence(type, best, result.totalCostUSD)
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

    console.log(
      `\nGenerated ${type} at ${outPath}. ${sizeLabel(type, best)}. Cost: $${result.totalCostUSD.toFixed(4)}.`
    )
    console.log(`Artifact ${saved.id} → status=${saved.status}, derivedVia=${saved.derivedVia}.`)
    if (result.error) {
      console.log(
        `(loop surfaced an error at iteration ${result.error.iteration}: ${result.error.message})`
      )
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
