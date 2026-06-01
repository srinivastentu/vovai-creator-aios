// In-process V1 pipeline runner for the acceptance test (CR-12).
//
// Chains all four production stages end-to-end IN-PROCESS (not via the CLI
// scripts), so the acceptance test has direct access to every result object
// (per-stage totalCostUSD, integratedArtifacts for the cosine check, persisted
// sections/sourceRefs) for its assertions:
//
//   Stage 2 Research → Stage 3 Long-Form Master → [Gate A auto-approve]
//   → Stage 5 LinkedIn (cross-critique) + Stage 5 Article (cross-critique)
//   → [Gate B auto-approve both → Idea completed]
//
// It reuses the SAME stage factories (createResearchStage / createMasterStage /
// create*CrossCritiqueStage) and the SAME persistence helpers
// (buildMasterPersistence / buildArtifactPersistence / buildRepurposeContext)
// the CLI scripts use, so it exercises the real pipeline. Only the small
// persona→context mapping (un-exported in the CLI scripts) is reproduced here.
//
// Gates auto-approve via direct Prisma updates (the CLI "dev auto-approve"
// path): the submitGate*Review server actions call revalidatePath, which throws
// outside a Next.js request, so the acceptance test flips status directly and
// validates the Idea-completion condition via the pure bothArtifactTypesApproved
// helper.
import { Prisma } from '@/generated/prisma/client'
import type { PrismaClient } from '@/generated/prisma/client'
import {
  createResearchStage,
  runResearchLoop,
} from '@/lib/domain/workflows/creator/research-stage'
import {
  createMasterStage,
  runMasterLoop,
  buildMasterPersistence,
} from '@/lib/domain/workflows/creator/long-form-master-stage'
import { masterWordCount } from '@/lib/domain/workflows/creator/validators/long-form-master-validator'
import {
  createLinkedInCrossCritiqueStage,
  createArticleCrossCritiqueStage,
  runCrossCritiqueLoop,
} from '@/lib/domain/workflows/creator/cross-critique-stage'
import { buildArtifactPersistence } from '@/lib/domain/workflows/creator/single-producer-stage'
import { buildRepurposeContext } from '@/lib/domain/workflows/creator/repurpose-context'
import { bothArtifactTypesApproved } from '@/lib/domain/workflows/creator/repurpose-persistence'
import { getDefaultGateway } from '@/lib/core/models/default-gateway'
import type {
  ResearchContext,
  MasterContext,
  MasterPersona,
  LinkedInArtifact,
  ArticleArtifact,
} from '@/lib/domain/workflows/creator/types'

// ── small persona-mapping helpers (faithful to the CLI scripts) ──────────────
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

interface PersonaRow {
  name: string
  voiceTone: unknown
  audienceProfile: unknown
  creatorProfile: unknown
}

/** Stage-2 audience summary (pipeline-research.ts): role — level. */
function audienceSummaryOf(persona: PersonaRow): string {
  const a = asRecord(persona.audienceProfile)
  return [str(a.primaryRole), str(a.experienceLevel)].filter(Boolean).join(' — ')
}

/** Stage-3 persona mapping (pipeline-master.ts: toMasterPersona). */
function toMasterPersona(persona: PersonaRow): MasterPersona {
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

/** Stage-3 judge persona-voice string (pipeline-master.ts: renderPersonaVoice). */
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

// ── result shapes ────────────────────────────────────────────────────────────
export interface StageCost {
  bestScore: number | null
  totalCostUSD: number
}

export interface PersistedSection {
  order: number
  heading: string
  sourceRefCount: number
}

export interface ArtifactRunResult<T> {
  artifactId: string
  artifact: T
  bestScore: number | null
  totalCostUSD: number
  /** Ordered integrated-artifact bodies, for the consecutive-cosine check. */
  integratedTexts: string[]
  terminationReason: string | null
  iterationCount: number
}

export interface PipelineRunResult {
  ideaId: string
  workspaceId: string
  masterId: string
  research: StageCost & { sourceCount: number }
  master: StageCost & {
    sections: PersistedSection[]
    sectionCount: number
    wordCount: number
    /** every persisted section has ≥ 1 sourceRef */
    everySectionHasSource: boolean
  }
  linkedin: ArtifactRunResult<LinkedInArtifact>
  article: ArtifactRunResult<ArticleArtifact>
  /** Sum of the four stage totals — the TRUE total cost (CR-12 cost decision). */
  totalCostUSD: number
  /** Gateway-routed subset (Stage 5 + judge); SDK-direct Stage 2/3 NOT counted. */
  ledgerTotalUSD: number
  ideaCompleted: boolean
}

export interface RunPipelineOpts {
  onLog?: (msg: string) => void
}

/**
 * Run the full V1 pipeline in-process against the seeded BuildOS idea and
 * return everything the acceptance test asserts on. Throws if any stage fails
 * to produce a usable artifact (bestArtifact === null).
 */
export async function runFullPipeline(
  db: PrismaClient,
  ideaId: string,
  opts: RunPipelineOpts = {},
): Promise<PipelineRunResult> {
  const log = opts.onLog ?? (() => {})

  const idea = await db.idea.findUnique({
    where: { id: ideaId },
    include: { workspace: { include: { persona: true } } },
  })
  if (!idea) throw new Error(`Idea not found: ${ideaId}`)
  const workspace = idea.workspace
  const persona = workspace.persona

  // ── Stage 2 — Research ─────────────────────────────────────────────────────
  log('Stage 2 (Research) — running…')
  const researchContext: ResearchContext = {
    ideaId: idea.id,
    ideaTitle: idea.title,
    ideaDescription: idea.description,
    niches: idea.niches,
    audienceSummary: audienceSummaryOf(persona),
  }
  const research = await runResearchLoop({
    stage: createResearchStage(),
    context: researchContext,
    onIteration: (e) =>
      log(
        e.validationFailed
          ? `  research v${e.version}: VALIDATION FAILED (${e.sourceCount} sources)`
          : `  research v${e.version}: ${e.score}/100, ${e.sourceCount} sources`,
      ),
  })
  const dossier = research.bestArtifact
  if (!dossier) {
    throw new Error(`Research produced no dossier${research.error ? ` (${research.error.message})` : ''}`)
  }
  // Persist a draft LongFormMaster + ResearchSources (pipeline-research.ts).
  const masterRow = await db.longFormMaster.create({
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
  log(`Stage 2 done — ${dossier.sources.length} sources, $${research.totalCostUSD.toFixed(4)}, master ${masterRow.id}`)

  // ── Stage 3 — Long-Form Master ─────────────────────────────────────────────
  log('Stage 3 (Long-Form Master) — running…')
  const masterPersona = toMasterPersona(persona)
  const masterContext: MasterContext = {
    longFormMasterId: masterRow.id,
    ideaTitle: idea.title,
    ideaDescription: idea.description,
    niches: idea.niches,
    persona: masterPersona,
    sources: masterRow.researchSources.map((rs) => ({
      researchSourceId: rs.id,
      url: rs.url,
      title: rs.title,
      snippet: rs.snippet,
    })),
  }
  const master = await runMasterLoop({
    stage: createMasterStage({ personaVoice: renderPersonaVoice(masterPersona) }),
    context: masterContext,
    onIteration: (e) =>
      log(
        e.validationFailed
          ? `  master v${e.version}: VALIDATION FAILED (${e.sectionCount} sections, ${e.wordCount} words)`
          : `  master v${e.version}: ${e.score}/100, ${e.sectionCount} sections, ${e.wordCount} words`,
      ),
  })
  const bestMaster = master.bestArtifact
  if (!bestMaster) {
    throw new Error(`Master produced nothing${master.error ? ` (${master.error.message})` : ''}`)
  }
  // Persist sections + SourceRefs, flip to gate_a_pending (pipeline-master.ts).
  const persistence = buildMasterPersistence(bestMaster)
  await db.longFormSection.deleteMany({ where: { longFormMasterId: masterRow.id } })
  await db.longFormMaster.update({
    where: { id: masterRow.id },
    data: {
      title: persistence.title,
      status: persistence.status,
      sections: {
        create: persistence.sections.map((s) => ({
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
  })
  const persistedMaster = await db.longFormMaster.findUniqueOrThrow({
    where: { id: masterRow.id },
    include: {
      sections: { orderBy: { order: 'asc' }, include: { sourceRefs: true } },
      idea: true,
      workspace: { include: { persona: true } },
    },
  })
  const persistedSections: PersistedSection[] = persistedMaster.sections.map((s) => ({
    order: s.order,
    heading: s.heading,
    sourceRefCount: s.sourceRefs.length,
  }))
  log(
    `Stage 3 done — ${persistedSections.length} sections, ${masterWordCount(bestMaster)} words, ` +
      `$${master.totalCostUSD.toFixed(4)}, score ${master.bestScore ?? 'n/a'}/100`,
  )

  // ── Gate A — auto-approve (dev) ────────────────────────────────────────────
  await db.longFormMaster.update({
    where: { id: masterRow.id },
    data: { status: 'approved', reviewedAt: new Date() },
  })
  log('Gate A — auto-approved.')

  // ── Stage 5 — Repurpose (cross-critique), per type ─────────────────────────
  const sharedMasterRow = {
    id: persistedMaster.id,
    title: persistedMaster.title,
    idea: { title: persistedMaster.idea.title, niches: persistedMaster.idea.niches },
    sections: persistedMaster.sections.map((s) => ({
      heading: s.heading,
      contentMarkdown: s.contentMarkdown,
    })),
    persona: {
      name: persona.name,
      voiceTone: persona.voiceTone,
      audienceProfile: persona.audienceProfile,
      creatorProfile: persona.creatorProfile,
    },
  }

  // LinkedIn
  log('Stage 5 (LinkedIn — cross-critique) — running…')
  const lp = buildRepurposeContext(sharedMasterRow, 'linkedin_post')
  const lpRun = await runCrossCritiqueLoop<LinkedInArtifact>({
    stage: createLinkedInCrossCritiqueStage({ personaContext: lp.personaContext }),
    context: lp.context,
    onIteration: (e) =>
      log(
        `  linkedin iter ${e.version}: ${e.judgeSkipped ? 'judge skipped' : `${e.score}/100`}, $${e.iterationCostUSD.toFixed(4)}`,
      ),
  })
  const lpBest = lpRun.bestArtifact
  if (!lpBest) {
    throw new Error(`LinkedIn produced nothing${lpRun.error ? ` (${lpRun.error.message})` : ''}`)
  }
  const lpPayload = buildArtifactPersistence('linkedin_post', lpBest, lpRun.totalCostUSD, lpRun.bestScore)
  const lpArtifact = await db.artifact.create({
    data: {
      workspaceId: workspace.id,
      longFormMasterId: masterRow.id,
      artifactType: lpPayload.artifactType,
      content: lpPayload.content as unknown as Prisma.InputJsonValue,
      parentArtifactIds: lpPayload.parentArtifactIds,
      derivedVia: lpPayload.derivedVia,
      bestScore: lpPayload.bestScore,
      status: lpPayload.status,
      costUSD: lpPayload.costUSD,
    },
  })
  log(
    `Stage 5 LinkedIn done — ${lpBest.charCount} chars, score ${lpRun.bestScore ?? 'n/a'}/100, ` +
      `$${lpRun.totalCostUSD.toFixed(4)}, ${lpRun.iterations.length} iters, ${lpRun.terminationReason ?? 'n/a'}`,
  )

  // Article
  log('Stage 5 (Article — cross-critique) — running…')
  const art = buildRepurposeContext(sharedMasterRow, 'long_form_article')
  const artRun = await runCrossCritiqueLoop<ArticleArtifact>({
    stage: createArticleCrossCritiqueStage({ personaContext: art.personaContext }),
    context: art.context,
    onIteration: (e) =>
      log(
        `  article iter ${e.version}: ${e.judgeSkipped ? 'judge skipped' : `${e.score}/100`}, $${e.iterationCostUSD.toFixed(4)}`,
      ),
  })
  const artBest = artRun.bestArtifact
  if (!artBest) {
    throw new Error(`Article produced nothing${artRun.error ? ` (${artRun.error.message})` : ''}`)
  }
  const artPayload = buildArtifactPersistence('long_form_article', artBest, artRun.totalCostUSD, artRun.bestScore)
  const artArtifact = await db.artifact.create({
    data: {
      workspaceId: workspace.id,
      longFormMasterId: masterRow.id,
      artifactType: artPayload.artifactType,
      content: artPayload.content as unknown as Prisma.InputJsonValue,
      parentArtifactIds: artPayload.parentArtifactIds,
      derivedVia: artPayload.derivedVia,
      bestScore: artPayload.bestScore,
      status: artPayload.status,
      costUSD: artPayload.costUSD,
    },
  })
  log(
    `Stage 5 Article done — ${artBest.wordCount} words, score ${artRun.bestScore ?? 'n/a'}/100, ` +
      `$${artRun.totalCostUSD.toFixed(4)}, ${artRun.iterations.length} iters, ${artRun.terminationReason ?? 'n/a'}`,
  )

  // ── Gate B — auto-approve both → Idea completed ────────────────────────────
  await db.artifact.updateMany({
    where: { longFormMasterId: masterRow.id, status: 'awaiting_review' },
    data: { status: 'approved', reviewedAt: new Date() },
  })
  const approvedArtifacts = await db.artifact.findMany({
    where: { longFormMasterId: masterRow.id },
    select: { artifactType: true, status: true },
  })
  let ideaCompleted = false
  if (bothArtifactTypesApproved(approvedArtifacts)) {
    const res = await db.idea.updateMany({
      where: { id: idea.id },
      data: { status: 'completed' },
    })
    ideaCompleted = res.count > 0
  }
  log(`Gate B — both artifacts approved; idea completed=${ideaCompleted}.`)

  const totalCostUSD =
    research.totalCostUSD + master.totalCostUSD + lpRun.totalCostUSD + artRun.totalCostUSD
  const ledgerTotalUSD = getDefaultGateway().getCostSummary().totalCostUsd

  return {
    ideaId: idea.id,
    workspaceId: workspace.id,
    masterId: masterRow.id,
    research: {
      bestScore: research.bestScore,
      totalCostUSD: research.totalCostUSD,
      sourceCount: dossier.sources.length,
    },
    master: {
      bestScore: master.bestScore,
      totalCostUSD: master.totalCostUSD,
      sections: persistedSections,
      sectionCount: persistedSections.length,
      wordCount: masterWordCount(bestMaster),
      everySectionHasSource: persistedSections.every((s) => s.sourceRefCount >= 1),
    },
    linkedin: {
      artifactId: lpArtifact.id,
      artifact: lpBest,
      bestScore: lpRun.bestScore,
      totalCostUSD: lpRun.totalCostUSD,
      integratedTexts: lpRun.integratedArtifacts.map((a) => a.text),
      terminationReason: lpRun.terminationReason ?? null,
      iterationCount: lpRun.iterations.length,
    },
    article: {
      artifactId: artArtifact.id,
      artifact: artBest,
      bestScore: artRun.bestScore,
      totalCostUSD: artRun.totalCostUSD,
      integratedTexts: artRun.integratedArtifacts.map((a) => a.markdown),
      terminationReason: artRun.terminationReason ?? null,
      iterationCount: artRun.iterations.length,
    },
    totalCostUSD,
    ledgerTotalUSD,
    ideaCompleted,
  }
}
