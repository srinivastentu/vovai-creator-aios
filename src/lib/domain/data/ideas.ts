"use server"

// Idea data layer — IdeaLog CRUD + the filtered list. Ideas are scoped by
// workspaceId, and every query additionally constrains workspace.userId to the
// current user so a forged workspaceId can't leak another user's ideas.

import { revalidatePath } from "next/cache"
import type { Idea, IdeaStatus } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"

export type { IdeaStatus }

export interface IdeaInput {
  workspaceId: string
  title: string
  description?: string
  niches?: string[]
  sourceUrl?: string
  status?: IdeaStatus
}

export interface IdeaUpdateInput {
  title?: string
  description?: string
  niches?: string[]
  sourceUrl?: string | null
  status?: IdeaStatus
}

export interface IdeaFilter {
  status?: IdeaStatus
  niche?: string
  q?: string
}

export async function listIdeas(
  workspaceId: string,
  filter?: IdeaFilter,
): Promise<Idea[]> {
  return db.idea.findMany({
    where: {
      workspaceId,
      workspace: { userId: getCurrentUserId() },
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.niche ? { niches: { has: filter.niche } } : {}),
      ...(filter?.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
}

async function assertOwnedWorkspace(workspaceId: string): Promise<void> {
  const ws = await db.workspace.findFirst({
    where: { id: workspaceId, userId: getCurrentUserId() },
    select: { id: true },
  })
  if (!ws) throw new Error("workspace_not_found")
}

export async function createIdea(input: IdeaInput): Promise<Idea> {
  await assertOwnedWorkspace(input.workspaceId)
  const row = await db.idea.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description ?? "",
      niches: input.niches ?? [],
      sourceUrl: input.sourceUrl ?? null,
      status: input.status ?? "captured",
    },
  })
  revalidatePath(`/workspaces/${input.workspaceId}/ideas`)
  revalidatePath(`/workspaces/${input.workspaceId}`)
  return row
}

export async function updateIdea(
  id: string,
  input: IdeaUpdateInput,
): Promise<Idea | null> {
  await db.idea.updateMany({
    where: { id, workspace: { userId: getCurrentUserId() } },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.niches !== undefined ? { niches: input.niches } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })
  const idea = await db.idea.findFirst({
    where: { id, workspace: { userId: getCurrentUserId() } },
  })
  if (idea) {
    revalidatePath(`/workspaces/${idea.workspaceId}/ideas`)
    revalidatePath(`/workspaces/${idea.workspaceId}`)
  }
  return idea
}

export async function deleteIdea(id: string): Promise<void> {
  // LongFormMaster → Idea is onDelete: Restrict — deleting a promoted idea that
  // already has a master throws (surfaced inline by the caller).
  const idea = await db.idea.findFirst({
    where: { id, workspace: { userId: getCurrentUserId() } },
    select: { workspaceId: true },
  })
  await db.idea.deleteMany({
    where: { id, workspace: { userId: getCurrentUserId() } },
  })
  if (idea) {
    revalidatePath(`/workspaces/${idea.workspaceId}/ideas`)
    revalidatePath(`/workspaces/${idea.workspaceId}`)
  }
}
