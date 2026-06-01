"use server"

// Workspace data layer — user-scoped server actions. A workspace always
// belongs to one persona; the list view joins the persona name + idea count
// + latest idea status for the row, and lastActiveAt drives ordering.

import { revalidatePath } from "next/cache"
import type { Workspace } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"

export interface WorkspaceInput {
  name: string
  personaId: string
  description?: string
  niches?: string[]
}

export interface WorkspaceUpdateInput {
  name?: string
  description?: string
  niches?: string[]
}

export async function listWorkspaces() {
  return db.workspace.findMany({
    where: { userId: getCurrentUserId() },
    orderBy: { lastActiveAt: "desc" },
    include: {
      persona: { select: { id: true, name: true } },
      _count: { select: { ideas: true } },
      ideas: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  })
}

export type WorkspaceListItem = Awaited<ReturnType<typeof listWorkspaces>>[number]

export async function getWorkspace(id: string): Promise<Workspace | null> {
  return db.workspace.findFirst({
    where: { id, userId: getCurrentUserId() }, // user-scoped; null if not owned
  })
}

export async function getWorkspaceDetail(id: string) {
  return db.workspace.findFirst({
    where: { id, userId: getCurrentUserId() },
    include: {
      persona: true,
      ideas: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { ideas: true } },
    },
  })
}

export type WorkspaceDetail = NonNullable<Awaited<ReturnType<typeof getWorkspaceDetail>>>

export async function createWorkspace(input: WorkspaceInput): Promise<Workspace> {
  const row = await db.workspace.create({
    data: {
      name: input.name,
      personaId: input.personaId,
      description: input.description ?? "",
      niches: input.niches ?? [],
      userId: getCurrentUserId(),
    },
  })
  revalidatePath("/workspaces")
  return row
}

export async function updateWorkspace(
  id: string,
  input: WorkspaceUpdateInput,
): Promise<Workspace | null> {
  await db.workspace.updateMany({
    where: { id, userId: getCurrentUserId() },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.niches !== undefined ? { niches: input.niches } : {}),
    },
  })
  revalidatePath("/workspaces")
  revalidatePath(`/workspaces/${id}`)
  return getWorkspace(id)
}

export async function deleteWorkspace(id: string): Promise<void> {
  // Idea/LongFormMaster/Artifact → Workspace are onDelete: Restrict — deleting
  // a workspace with dependent rows throws (surfaced inline by the caller).
  await db.workspace.deleteMany({
    where: { id, userId: getCurrentUserId() },
  })
  revalidatePath("/workspaces")
}

// Called from the dashboard loader on every visit. No revalidate (avoids a
// render→revalidate loop); the new timestamp surfaces on the next list fetch.
export async function touchLastActive(id: string): Promise<void> {
  await db.workspace.updateMany({
    where: { id, userId: getCurrentUserId() },
    data: { lastActiveAt: new Date() },
  })
}
