#!/usr/bin/env tsx
// CR-2 — Stage 2 (Research) CLI runner.
// Usage: npm run pipeline:research -- --ideaId=<idea-id>
//
// Loads the Idea + its Workspace + CreatorPersona, runs the Research loop to
// completion (auto-approved — Gate A UI arrives in CR-10), persists a draft
// LongFormMaster + its ResearchSource rows, and writes the dossier JSON to
// tmp/runs/<ideaId>/research-dossier.json.
//
// Requires ANTHROPIC_API_KEY (web search) and OPENAI_API_KEY (judge).
// Load .env.local first (canonical local secrets) then .env — earlier files
// win, matching Next.js precedence. dotenv/config alone only reads .env.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: ['.env.local', '.env'] })
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  createResearchStage,
  runResearchLoop,
} from '../src/lib/domain/workflows/creator/research-stage'
import type { ResearchContext } from '../src/lib/domain/workflows/creator/types'

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function audienceSummaryOf(persona: { audienceProfile: unknown }): string {
  const a = persona.audienceProfile as Record<string, unknown> | null
  if (!a) return ''
  const role = typeof a.primaryRole === 'string' ? a.primaryRole : ''
  const level = typeof a.experienceLevel === 'string' ? a.experienceLevel : ''
  return [role, level].filter(Boolean).join(' — ')
}

async function main() {
  const ideaId = parseArg('ideaId')
  if (!ideaId) {
    console.error('Usage: npm run pipeline:research -- --ideaId=<idea-id>')
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
    const idea = await db.idea.findUnique({
      where: { id: ideaId },
      include: { workspace: { include: { persona: true } } },
    })
    if (!idea) throw new Error(`Idea not found: ${ideaId}`)

    const workspace = idea.workspace
    const persona = workspace.persona

    const context: ResearchContext = {
      ideaId: idea.id,
      ideaTitle: idea.title,
      ideaDescription: idea.description,
      niches: idea.niches,
      audienceSummary: audienceSummaryOf(persona),
    }

    console.log(`\n=== RESEARCH STAGE: "${idea.title}" ===`)
    console.log(`Persona: ${persona.name}  |  Workspace: ${workspace.name}\n`)

    const stage = createResearchStage()
    const result = await runResearchLoop({
      stage,
      context,
      onIteration: (e) => {
        if (e.validationFailed) {
          console.log(`v${e.version}: VALIDATION FAILED (${e.sourceCount} sources) — revising.`)
          return
        }
        const dims = e.dimensionScores.map((d) => `${d.dimensionId}=${d.score}`).join(' ')
        console.log(
          `Iteration ${e.version}: score ${e.score}/100, ${e.sourceCount} sources — ${dims}`
        )
      },
    })

    const dossier = result.bestArtifact
    if (!dossier) {
      throw new Error('Research loop produced no usable dossier')
    }

    // Auto-approve (dev): persist a draft LongFormMaster + its ResearchSources.
    // TODO(CR-9): persist result.totalCostUSD to the cost ledger / StageSession
    // so per-stage cost survives the process (Principle 6 — cost transparency).
    const master = await db.longFormMaster.create({
      data: {
        workspaceId: workspace.id,
        ideaId: idea.id,
        title: idea.title,
        status: 'draft',
        researchSources: {
          create: dossier.sources.map((s) => ({
            url: s.url,
            type: 'web' as const,
            title: s.title,
            snippet: s.snippet,
          })),
        },
      },
      include: { researchSources: true },
    })

    // Write the dossier JSON to disk.
    const outDir = resolve(process.cwd(), 'tmp', 'runs', ideaId)
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, 'research-dossier.json')
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          ideaId: dossier.ideaId,
          longFormMasterId: master.id,
          query: dossier.query,
          bestScore: result.bestScore,
          searchCount: dossier.searchCount,
          totalCostUSD: result.totalCostUSD,
          sourceCount: dossier.sources.length,
          sources: dossier.sources,
          summary: dossier.summary,
          error: result.error ?? null,
        },
        null,
        2
      ),
      'utf8'
    )

    console.log(
      `\nDone. ${dossier.sources.length} sources. Cost: $${result.totalCostUSD.toFixed(4)}. Dossier at ${outPath}.`
    )
    console.log(`LongFormMaster (draft): ${master.id}  (${master.researchSources.length} ResearchSource rows)`)
    console.log(`→ For CR-3:  npm run pipeline:master -- --longFormMasterId=${master.id}\n`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
