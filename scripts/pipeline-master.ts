#!/usr/bin/env tsx
// CR-3 — Stage 3 (Long-Form Master) CLI runner.
// Usage: npm run pipeline:master -- --longFormMasterId=<draft-id>
//
// Loads a draft LongFormMaster (its ResearchSources from CR-2) plus the Idea +
// Workspace + CreatorPersona, runs the Long-Form Master loop to completion
// (auto-approved — Gate A UI arrives in CR-10), persists the structured
// sections + SourceRefs and flips the master to status='gate_a_pending', and
// writes a rendered master to tmp/runs/<ideaId>/long-form-master.md.
//
// Requires ANTHROPIC_API_KEY (synthesizer) and OPENAI_API_KEY (judge).
// Load .env.local first (canonical local secrets) then .env — earlier files
// win, matching Next.js precedence. dotenv/config alone only reads .env.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: ['.env.local', '.env'] })
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  createMasterStage,
  runMasterLoop,
  buildMasterPersistence,
} from '../src/lib/domain/workflows/creator/long-form-master-stage'
import { masterWordCount } from '../src/lib/domain/workflows/creator/validators/long-form-master-validator'
import type {
  MasterArtifact,
  MasterContext,
  MasterPersona,
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

function toMasterPersona(persona: {
  name: string
  voiceTone: unknown
  audienceProfile: unknown
  creatorProfile: unknown
}): MasterPersona {
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
    doNotSay: strArr(voice.doNotSay),
  }
}

function renderPersonaVoice(p: MasterPersona): string {
  return [
    `${p.name}.`,
    p.voiceSummary,
    p.pointOfView ? `POV: ${p.pointOfView}` : '',
    p.audienceSummary ? `Audience: ${p.audienceSummary}` : '',
    p.doNotSay.length ? `Avoid: ${p.doNotSay.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function renderMarkdown(
  master: MasterArtifact,
  sourceById: Map<string, { url: string; title: string }>
): string {
  const lines: string[] = [`# ${master.title}`, '']
  for (const s of master.sections) {
    lines.push(`## ${s.heading}`, '', s.contentMarkdown, '')
    const cites = s.sourceRefs
      .map((r) => {
        const src = sourceById.get(r.researchSourceId)
        return src ? `[${src.title}](${src.url})` : null
      })
      .filter(Boolean)
    if (cites.length) lines.push(`**Sources:** ${cites.join(' · ')}`, '')
  }
  return lines.join('\n')
}

async function main() {
  const longFormMasterId = parseArg('longFormMasterId')
  if (!longFormMasterId) {
    console.error('Usage: npm run pipeline:master -- --longFormMasterId=<draft-id>')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('ANTHROPIC_API_KEY and OPENAI_API_KEY must be set.')
    process.exit(1)
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const db = new PrismaClient({ adapter })

  try {
    const master = await db.longFormMaster.findUnique({
      where: { id: longFormMasterId },
      include: {
        researchSources: true,
        idea: true,
        workspace: { include: { persona: true } },
      },
    })
    if (!master) throw new Error(`LongFormMaster not found: ${longFormMasterId}`)
    if (master.researchSources.length === 0) {
      throw new Error(
        `LongFormMaster ${longFormMasterId} has no ResearchSources — run pipeline:research first.`
      )
    }

    const persona = toMasterPersona(master.workspace.persona)
    const context: MasterContext = {
      longFormMasterId: master.id,
      ideaTitle: master.idea.title,
      ideaDescription: master.idea.description,
      niches: master.idea.niches,
      persona,
      sources: master.researchSources.map((rs) => ({
        researchSourceId: rs.id,
        url: rs.url,
        title: rs.title,
        snippet: rs.snippet,
      })),
    }

    console.log(`\n=== LONG-FORM MASTER STAGE: "${master.idea.title}" ===`)
    console.log(
      `Persona: ${persona.name}  |  Workspace: ${master.workspace.name}  |  ${master.researchSources.length} sources\n`
    )

    const stage = createMasterStage({ personaVoice: renderPersonaVoice(persona) })
    const result = await runMasterLoop({
      stage,
      context,
      onIteration: (e) => {
        if (e.validationFailed) {
          console.log(
            `v${e.version}: VALIDATION FAILED (${e.sectionCount} sections, ${e.wordCount} words) — revising.`
          )
          return
        }
        const dims = e.dimensionScores.map((d) => `${d.dimensionId}=${d.score}`).join(' ')
        console.log(
          `Iteration ${e.version}: score ${e.score}/100, ${e.sectionCount} sections, ${e.wordCount} words — ${dims}`
        )
      },
    })

    const best = result.bestArtifact
    if (!best) throw new Error('Master loop produced no usable Long-Form Master')

    // Auto-approve (dev): persist sections + SourceRefs, flip to gate_a_pending.
    // TODO(CR-9): persist result.totalCostUSD to the cost ledger / StageSession.
    const payload = buildMasterPersistence(best)
    // Clean re-run: drop any prior sections (cascade removes their SourceRefs).
    await db.longFormSection.deleteMany({ where: { longFormMasterId: master.id } })
    const saved = await db.longFormMaster.update({
      where: { id: master.id },
      data: {
        title: payload.title,
        status: payload.status,
        sections: {
          create: payload.sections.map((s) => ({
            order: s.order,
            heading: s.heading,
            contentMarkdown: s.contentMarkdown,
            sourceRefs: {
              create: s.sourceRefs.map((r) => ({
                relevanceSnippet: r.relevanceSnippet,
                researchSource: { connect: { id: r.researchSourceId } },
              })),
            },
          })),
        },
      },
      include: { sections: { include: { sourceRefs: true } } },
    })

    const sourceById = new Map(
      master.researchSources.map((rs) => [rs.id, { url: rs.url, title: rs.title }])
    )
    const outDir = resolve(process.cwd(), 'tmp', 'runs', master.ideaId)
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, 'long-form-master.md')
    writeFileSync(outPath, renderMarkdown(best, sourceById), 'utf8')

    const words = masterWordCount(best)
    const refCount = saved.sections.reduce((t, s) => t + s.sourceRefs.length, 0)
    console.log(
      `\nDone. ${saved.sections.length} sections, ${words} words, ${refCount} SourceRefs. ` +
        `Best score: ${result.bestScore ?? 'n/a'}/100. Cost: $${result.totalCostUSD.toFixed(4)}.`
    )
    console.log(`Master "${saved.title}" → status=${saved.status}  (${saved.id})`)
    console.log(`Rendered master at ${outPath}.`)
    if (result.error) {
      console.log(`(loop surfaced an error at iteration ${result.error.iteration}: ${result.error.message})`)
    }
    console.log(`→ For CR-4:  npm run pipeline:produce -- --longFormMasterId=${saved.id} --type=linkedin_post\n`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
