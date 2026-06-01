"use server"

// Artifact mutations — Gate B (CR-11) review + fork-on-regenerate. Separated from
// the read queries (artifacts.ts) so only these mutations are exposed as server
// actions (CR-10 "narrow the server-action surface" follow-up). Every mutation
// user-scopes through workspace.userId; the review transition is TOCTOU-guarded
// (status in the updateMany where-clause) and idempotent.

import { revalidatePath } from "next/cache"
import type { ArtifactStatus } from "@/generated/prisma/client"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"
import {
  validateGateBReview,
  resolveGateBTransition,
  resolveArtifactReviewFeedback,
  REVIEWABLE_ARTIFACT_STATUS,
  type GateBReviewAction,
} from "@/lib/domain/workflows/creator/review/artifact-review"
import {
  rebuildArtifactContent,
  bothArtifactTypesApproved,
  editForkSpec,
  regenForkSpec,
} from "@/lib/domain/workflows/creator/repurpose-persistence"
import { buildRepurposeContext } from "@/lib/domain/workflows/creator/repurpose-context"
import {
  liveRegenRunner,
  type RegenRunner,
} from "@/lib/domain/workflows/creator/regenerate-runner"
import type { ArticleArtifact, LinkedInArtifact } from "@/lib/domain/workflows/creator/types"

const asJson = (v: unknown): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue

/** Existing Artifact.content title (article), or the fallback (LinkedIn / no title). */
function contentTitle(content: unknown, fallback: string): string {
  if (content && typeof content === "object" && "title" in content) {
    const t = (content as { title?: unknown }).title
    if (typeof t === "string" && t.trim()) return t.trim()
  }
  return fallback
}

/** The raw editable body of an Artifact.content (LinkedIn text / article markdown). */
function bodyText(content: unknown): string {
  if (content && typeof content === "object") {
    const c = content as { text?: unknown; markdown?: unknown }
    if (typeof c.markdown === "string") return c.markdown
    if (typeof c.text === "string") return c.text
  }
  return ""
}

export interface GateBReviewResult {
  status: ArtifactStatus
  /** True when this approval completed the Idea (both artifact types approved). */
  ideaCompleted: boolean
}

/**
 * Apply a Gate B review action to an artifact. Validates against the artifact's
 * current status (human sovereignty), re-validates inline edits against the
 * deterministic content bounds, then in one TOCTOU-guarded transaction persists the
 * transition (+ edited content / reviewer note). On approve it checks whether both
 * V1 artifact types are now approved for the master and, if so, completes the Idea.
 */
export async function submitGateBReview(
  artifactId: string,
  action: GateBReviewAction,
): Promise<GateBReviewResult> {
  const userId = getCurrentUserId()

  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, workspace: { userId } },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      artifactType: true,
      content: true,
      longFormMasterId: true,
      longFormMaster: { select: { ideaId: true, title: true } },
    },
  })
  if (!artifact) throw new Error("This artifact could not be found.")

  const error = validateGateBReview(action, artifact.status)
  if (error) throw new Error(error.message)

  const nextStatus = resolveGateBTransition(action)
  const note = resolveArtifactReviewFeedback(action)
  const reviewedAt = new Date()

  // inline_edit mutates the body in place (implicit approval) — rebuild content
  // with counts recomputed by code, and re-validate against the publishable bounds.
  let editedContent: Prisma.InputJsonValue | undefined
  if (action.type === "inline_edit") {
    const { content, validation } = rebuildArtifactContent(
      artifact.artifactType,
      action.content,
      contentTitle(artifact.content, artifact.longFormMaster.title),
    )
    if (!validation.valid) {
      throw new Error(`Edit not saved — ${validation.errors.map((e) => e.message).join("; ")}.`)
    }
    editedContent = asJson(content)
  }

  const { ideaCompleted } = await db.$transaction(async (tx) => {
    const updated = await tx.artifact.updateMany({
      where: { id: artifactId, status: REVIEWABLE_ARTIFACT_STATUS, workspace: { userId } },
      data: {
        status: nextStatus,
        reviewFeedback: note,
        reviewedAt,
        ...(editedContent !== undefined ? { content: editedContent } : {}),
      },
    })
    // Zero rows → the artifact left awaiting_review between our read and write
    // (already reviewed elsewhere). Idempotent: surface, don't double-apply.
    if (updated.count === 0) throw new Error("This artifact was already reviewed.")

    let completed = false
    if (nextStatus === "approved") {
      const all = await tx.artifact.findMany({
        where: { longFormMasterId: artifact.longFormMasterId, workspace: { userId } },
        select: { artifactType: true, status: true },
      })
      if (bothArtifactTypesApproved(all)) {
        const res = await tx.idea.updateMany({
          where: { id: artifact.longFormMaster.ideaId, workspace: { userId } },
          data: { status: "completed" },
        })
        completed = res.count > 0
      }
    }
    return { ideaCompleted: completed }
  })

  revalidatePath(`/workspaces/${artifact.workspaceId}`)
  revalidatePath(`/workspaces/${artifact.workspaceId}/artifacts/${artifactId}/review`)
  if (ideaCompleted) revalidatePath(`/workspaces/${artifact.workspaceId}/ideas`)

  return { status: nextStatus, ideaCompleted }
}

export interface RegenerateResult {
  editedArtifactId: string
  regeneratedArtifactId: string
}

/**
 * Fork-on-regenerate (decisions log): captures the human's edit as a new
 * `inline_edit` Artifact (A_edited, parented to the current artifact), runs a fresh
 * cross-critique loop with that edit as priority context, and persists the result
 * as a `regenerate` Artifact (A_regen, parented to A_edited) plus its StageSession +
 * iteration history. Originals are never mutated (Immutable History).
 *
 * The loop runs LIVE in the server action (gated on API keys). Tests inject `runner`
 * to exercise the fork lineage + persistence without hitting any model.
 */
export async function regenerateArtifact(
  artifactId: string,
  editedBody: string,
  opts: { runner?: RegenRunner } = {},
): Promise<RegenerateResult> {
  const userId = getCurrentUserId()

  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, workspace: { userId } },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      artifactType: true,
      content: true,
      bestScore: true,
      longFormMasterId: true,
    },
  })
  if (!artifact) throw new Error("This artifact could not be found.")
  if (artifact.status !== REVIEWABLE_ARTIFACT_STATUS) {
    throw new Error("Regenerate is only available while the artifact is awaiting review.")
  }

  const master = await db.longFormMaster.findFirst({
    where: { id: artifact.longFormMasterId, workspace: { userId } },
    select: {
      id: true,
      title: true,
      idea: { select: { title: true, niches: true } },
      sections: {
        orderBy: { order: "asc" },
        select: { heading: true, contentMarkdown: true },
      },
      workspace: {
        select: {
          persona: {
            select: {
              name: true,
              voiceTone: true,
              audienceProfile: true,
              creatorProfile: true,
            },
          },
        },
      },
    },
  })
  if (!master) throw new Error("The source master could not be found.")

  // The edited body becomes A_edited's content — rebuilt + re-validated so the
  // seed (and the persisted fork) is a well-formed artifact.
  const { content: editedContent, validation } = rebuildArtifactContent(
    artifact.artifactType,
    editedBody,
    contentTitle(artifact.content, master.title),
  )
  if (!validation.valid) {
    throw new Error(`Can't regenerate — the edit ${validation.errors.map((e) => e.message).join("; ")}.`)
  }

  // Pick the runner: injected (tests) or the live cross-critique loop (gated on
  // keys, so a missing-key server never half-creates a fork).
  const runner = opts.runner ?? requireLiveRunner()

  const editFork = await db.artifact.create({
    data: {
      workspaceId: artifact.workspaceId,
      longFormMasterId: artifact.longFormMasterId,
      artifactType: artifact.artifactType,
      content: asJson(editedContent),
      ...editForkSpec(artifactId),
      bestScore: artifact.bestScore,
      costUSD: 0,
    },
  })

  const { context, personaContext } = buildRepurposeContext(
    {
      id: master.id,
      title: master.title,
      idea: master.idea,
      sections: master.sections,
      persona: master.workspace.persona,
    },
    artifact.artifactType,
  )
  context.priorEditText =
    artifact.artifactType === "linkedin_post"
      ? (editedContent as LinkedInArtifact).text
      : (editedContent as ArticleArtifact).markdown

  const outcome = await runner({ context, type: artifact.artifactType, personaContext })
  if (!outcome.best) {
    // A_edited persists (the human's saved edit); only the regeneration failed.
    throw new Error(
      `Regeneration produced no usable ${artifact.artifactType}` +
        (outcome.terminationReason ? ` (${outcome.terminationReason}).` : "."),
    )
  }

  const regenFork = await db.$transaction(async (tx) => {
    const created = await tx.artifact.create({
      data: {
        workspaceId: artifact.workspaceId,
        longFormMasterId: artifact.longFormMasterId,
        artifactType: artifact.artifactType,
        content: asJson(outcome.best),
        ...regenForkSpec(editFork.id),
        bestScore: outcome.bestScore,
        costUSD: outcome.totalCostUSD,
      },
    })
    await tx.stageSession.create({
      data: {
        workspaceId: artifact.workspaceId,
        stageId: outcome.stageId,
        status: "completed",
        finalArtifactId: created.id,
        terminationReason: outcome.terminationReason,
        costUSD: outcome.totalCostUSD,
        completedAt: new Date(),
        iterationRecords: {
          create: outcome.historyRows.map((r) => ({
            version: r.version,
            gradeJson: r.gradeJson ? asJson(r.gradeJson) : Prisma.JsonNull,
            detailJson: asJson(r.detailJson),
            modelUsed: r.modelUsed,
            tokensIn: r.tokensIn,
            tokensOut: r.tokensOut,
            costUSD: r.costUSD,
          })),
        },
      },
    })
    return created
  })

  revalidatePath(`/workspaces/${artifact.workspaceId}`)
  revalidatePath(`/workspaces/${artifact.workspaceId}/artifacts/${artifactId}/review`)
  revalidatePath(`/workspaces/${artifact.workspaceId}/artifacts/${regenFork.id}/review`)

  return { editedArtifactId: editFork.id, regeneratedArtifactId: regenFork.id }
}

/** The live runner, guarded by the three model keys it needs. */
function requireLiveRunner(): RegenRunner {
  const missing = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GEMINI_API_KEY"].filter(
    (k) => !process.env[k],
  )
  if (missing.length > 0) {
    throw new Error(
      `Regeneration needs ${missing.join(", ")}. Set the key(s) or run the pipeline via the CLI.`,
    )
  }
  return liveRegenRunner
}
