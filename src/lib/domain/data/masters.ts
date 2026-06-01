"use server"

// Long-Form Master data layer — user-scoped server actions for the Gate A
// review UI. Masters are scoped by workspaceId, and every query additionally
// constrains workspace.userId to the current user so a forged id can't read or
// mutate another user's master. The review mutation delegates its decision logic
// to the pure Gate A review module (workflows/creator/review/master-review).

import { revalidatePath } from "next/cache"
import type { MasterStatus } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"
import {
  validateGateAReview,
  resolveGateATransition,
  resolveReviewFeedback,
  type GateAReviewAction,
} from "@/lib/domain/workflows/creator/review/master-review"

/** Full master + ordered sections + each section's source refs, for Gate A. */
export async function getMasterForReview(masterId: string) {
  return db.longFormMaster.findFirst({
    where: { id: masterId, workspace: { userId: getCurrentUserId() } },
    include: {
      workspace: { select: { id: true, name: true } },
      idea: { select: { id: true, title: true } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          sourceRefs: {
            include: {
              researchSource: {
                select: { id: true, url: true, title: true, type: true, snippet: true },
              },
            },
          },
        },
      },
      researchSources: { orderBy: { fetchedAt: "asc" } },
    },
  })
}

export type MasterForReview = NonNullable<Awaited<ReturnType<typeof getMasterForReview>>>
export type MasterSectionForReview = MasterForReview["sections"][number]

/** Masters for a workspace — the dashboard "pipeline runs" list. */
export async function listMastersForWorkspace(workspaceId: string) {
  return db.longFormMaster.findMany({
    where: { workspaceId, workspace: { userId: getCurrentUserId() } },
    orderBy: { updatedAt: "desc" },
    include: {
      idea: { select: { id: true, title: true } },
      _count: { select: { sections: true, researchSources: true, artifacts: true } },
    },
  })
}

export type MasterListItem = Awaited<ReturnType<typeof listMastersForWorkspace>>[number]

export interface GateAReviewResult {
  status: MasterStatus
}

/**
 * Apply a Gate A review action to a master. Validates against the master's
 * current status (human sovereignty), then in one transaction persists any
 * inline-edited sections, the new status, the reviewer note, and reviewedAt.
 * Throws with a user-meaningful message when the action is invalid or the
 * master is not owned by the current user.
 */
export async function submitGateAReview(
  masterId: string,
  action: GateAReviewAction,
): Promise<GateAReviewResult> {
  const userId = getCurrentUserId()

  const master = await db.longFormMaster.findFirst({
    where: { id: masterId, workspace: { userId } },
    select: { id: true, status: true, workspaceId: true },
  })
  if (!master) throw new Error("This master could not be found.")

  const error = validateGateAReview(action, master.status)
  if (error) throw new Error(error.message)

  const nextStatus = resolveGateATransition(action)
  const note = resolveReviewFeedback(action)
  const reviewedAt = new Date()

  await db.$transaction(async (tx) => {
    if (action.type === "inline_edit") {
      // Sections are scoped to this (already-ownership-verified) master, so a
      // forged section id from another master simply matches zero rows.
      for (const s of action.sections) {
        await tx.longFormSection.updateMany({
          where: { id: s.id, longFormMasterId: masterId },
          data: { heading: s.heading, contentMarkdown: s.contentMarkdown },
        })
      }
    }
    await tx.longFormMaster.updateMany({
      where: { id: masterId, workspace: { userId } },
      data: { status: nextStatus, reviewFeedback: note, reviewedAt },
    })
  })

  revalidatePath(`/workspaces`)
  revalidatePath(`/workspaces/${master.workspaceId}`)
  revalidatePath(`/workspaces/${master.workspaceId}/master/${masterId}/review`)

  return { status: nextStatus }
}
