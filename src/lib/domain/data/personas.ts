"use server"

// Persona data layer — thin, typed, user-scoped server actions over Prisma.
// Every query filters by getCurrentUserId() so no action ever touches another
// user's rows (the Clerk swap in V2 is then a one-line change).

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import type { CreatorPersona } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth/current-user"
import type { PersonaFormValues } from "@/lib/domain/persona-schema"

export type PersonaInput = PersonaFormValues

function toData(input: PersonaInput) {
  return {
    name: input.name,
    niches: input.niches,
    voiceTone: input.voiceTone as unknown as Prisma.InputJsonValue,
    audienceProfile: input.audienceProfile as unknown as Prisma.InputJsonValue,
    creatorProfile: input.creatorProfile as unknown as Prisma.InputJsonValue,
    defaultRubricRefs: input.defaultRubricRefs as unknown as Prisma.InputJsonValue,
  }
}

export async function listPersonas(): Promise<CreatorPersona[]> {
  return db.creatorPersona.findMany({
    where: { userId: getCurrentUserId() },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getPersona(id: string): Promise<CreatorPersona | null> {
  return db.creatorPersona.findFirst({
    where: { id, userId: getCurrentUserId() }, // user-scoped; null if not owned
  })
}

export async function createPersona(input: PersonaInput): Promise<CreatorPersona> {
  const row = await db.creatorPersona.create({
    data: { ...toData(input), userId: getCurrentUserId() },
  })
  revalidatePath("/personas")
  return row
}

export async function updatePersona(
  id: string,
  input: PersonaInput,
): Promise<CreatorPersona | null> {
  // updateMany so the userId scope is enforced in the where clause.
  await db.creatorPersona.updateMany({
    where: { id, userId: getCurrentUserId() },
    data: toData(input),
  })
  revalidatePath("/personas")
  revalidatePath(`/personas/${id}`)
  return getPersona(id)
}

export async function deletePersona(id: string): Promise<void> {
  // Workspace → CreatorPersona is onDelete: Restrict — deleting a persona that
  // still has workspaces throws (surfaced inline by the caller).
  await db.creatorPersona.deleteMany({
    where: { id, userId: getCurrentUserId() },
  })
  revalidatePath("/personas")
}
