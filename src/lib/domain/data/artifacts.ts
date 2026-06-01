// Artifact data layer — READ queries for the Gate B (CR-11) per-artifact review.
// Plain server-only module (no "use server"): the server pages import these
// directly as async functions; the mutations live in artifact-actions.ts. Every
// query user-scopes through workspace.userId so a forged id can't read another
// user's artifact (mirrors the masters/ideas data layers).

import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"

/**
 * One artifact + its review context: the parent master + idea + workspace, the
 * StageSession that produced it (with ordered iteration records — the history
 * panel's source), and all sibling artifacts of the same master (branches, for the
 * diff + flip). Null when not found or not owned.
 */
export async function getArtifactForReview(artifactId: string) {
  const userId = getCurrentUserId()

  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, workspace: { userId } },
    include: {
      workspace: { select: { id: true, name: true } },
      longFormMaster: {
        select: {
          id: true,
          title: true,
          idea: { select: { id: true, title: true, status: true } },
        },
      },
    },
  })
  if (!artifact) return null

  // StageSession links to the artifact by finalArtifactId (a plain id, not a
  // relation). The regenerate action / produce CLI write it. Latest first.
  const stageSession = await db.stageSession.findFirst({
    where: { finalArtifactId: artifact.id, workspace: { userId } },
    orderBy: { startedAt: "desc" },
    include: { iterationRecords: { orderBy: { version: "asc" } } },
  })

  // All artifacts for the same master — the fork lineage / sibling branches the UI
  // diffs and flips between. Content included (V1: a handful of artifacts).
  const siblings = await db.artifact.findMany({
    where: { longFormMasterId: artifact.longFormMasterId, workspace: { userId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      artifactType: true,
      derivedVia: true,
      status: true,
      bestScore: true,
      parentArtifactIds: true,
      content: true,
      createdAt: true,
    },
  })

  return { artifact, stageSession, siblings }
}

export type ArtifactForReview = NonNullable<Awaited<ReturnType<typeof getArtifactForReview>>>

/**
 * Artifacts for a workspace — the dashboard "repurposed artifacts" list. Excludes
 * `inline_edit` seed forks (the intermediate A_edited of a regenerate): they are not
 * standalone deliverables and remain reachable via a branch's Gate B Branches panel.
 */
export async function listArtifactsForWorkspace(workspaceId: string) {
  return db.artifact.findMany({
    where: {
      workspaceId,
      workspace: { userId: getCurrentUserId() },
      NOT: { derivedVia: "inline_edit" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      artifactType: true,
      status: true,
      bestScore: true,
      derivedVia: true,
      costUSD: true,
      createdAt: true,
      longFormMaster: { select: { id: true, title: true } },
    },
  })
}

export type ArtifactListItem = Awaited<ReturnType<typeof listArtifactsForWorkspace>>[number]
