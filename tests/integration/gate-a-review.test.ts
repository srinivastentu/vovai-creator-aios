// Real-DB integration tests for the CR-10 Gate A review data layer. They run
// against the dev database (DATABASE_URL), seed a full master (sections + a
// research source + a source ref), exercise every review action, and clean up.
// Skipped cleanly when no DATABASE_URL is configured (e.g. CI without a DB).
import "dotenv/config"
import { describe, it, expect, beforeAll, vi } from "vitest"

// revalidatePath throws outside a Next request context — stub it.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

import type { MasterStatus } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { createPersona, deletePersona } from "@/lib/domain/data/personas"
import { createWorkspace, deleteWorkspace } from "@/lib/domain/data/workspaces"
import { createIdea, deleteIdea } from "@/lib/domain/data/ideas"
import { EMPTY_PERSONA } from "@/lib/domain/persona-schema"
import {
  getMasterForReview,
  listMastersForWorkspace,
  submitGateAReview,
} from "@/lib/domain/data/masters"

const hasDb = Boolean(process.env.DATABASE_URL)
const suite = hasDb ? describe : describe.skip

interface Seed {
  personaId: string
  workspaceId: string
  ideaId: string
  masterId: string
  sectionIds: string[]
}

async function seedMaster(status: MasterStatus): Promise<Seed> {
  const persona = await createPersona({ ...EMPTY_PERSONA, name: "GateA Persona" })
  const ws = await createWorkspace({ name: "GateA WS", personaId: persona.id })
  const idea = await createIdea({ workspaceId: ws.id, title: "GateA idea" })
  const master = await db.longFormMaster.create({
    data: { workspaceId: ws.id, ideaId: idea.id, title: "GateA master", status },
  })
  const source = await db.researchSource.create({
    data: {
      longFormMasterId: master.id,
      url: "https://example.com/a",
      type: "web",
      title: "Source A",
      snippet: "snippet a",
    },
  })
  const s1 = await db.longFormSection.create({
    data: { longFormMasterId: master.id, order: 1, heading: "Intro", contentMarkdown: "Body 1" },
  })
  const s2 = await db.longFormSection.create({
    data: { longFormMasterId: master.id, order: 2, heading: "Body", contentMarkdown: "Body 2" },
  })
  await db.sourceRef.create({
    data: { sectionId: s1.id, researchSourceId: source.id, relevanceSnippet: "rel a" },
  })
  return {
    personaId: persona.id,
    workspaceId: ws.id,
    ideaId: idea.id,
    masterId: master.id,
    sectionIds: [s1.id, s2.id],
  }
}

async function cleanup(seed: Seed) {
  // Deleting the master cascades its sections, research sources, and source refs.
  // Master → Idea is Restrict, so the master must go before the idea.
  await db.longFormMaster.delete({ where: { id: seed.masterId } })
  await deleteIdea(seed.ideaId)
  await deleteWorkspace(seed.workspaceId)
  await deletePersona(seed.personaId)
}

suite("CR-10 Gate A review (real DB)", () => {
  beforeAll(async () => {
    await db.user.upsert({
      where: { id: "local-user" },
      update: {},
      create: { id: "local-user", email: "local@creator.os" },
    })
  })

  it("approve locks the master to approved and clears any note", async () => {
    const seed = await seedMaster("gate_a_pending")
    const res = await submitGateAReview(seed.masterId, { type: "approve" })
    expect(res.status).toBe("approved")

    const m = await db.longFormMaster.findUnique({ where: { id: seed.masterId } })
    expect(m?.status).toBe("approved")
    expect(m?.reviewedAt).not.toBeNull()
    expect(m?.reviewFeedback).toBeNull()

    await cleanup(seed)
  })

  it("feedback persists the note and returns the master to draft", async () => {
    const seed = await seedMaster("gate_a_pending")
    const res = await submitGateAReview(seed.masterId, {
      type: "feedback",
      message: "Tighten section 2",
    })
    expect(res.status).toBe("draft")

    const m = await db.longFormMaster.findUnique({ where: { id: seed.masterId } })
    expect(m?.status).toBe("draft")
    expect(m?.reviewFeedback).toBe("Tighten section 2")
    expect(m?.reviewedAt).not.toBeNull()

    await cleanup(seed)
  })

  it("reject returns the master to draft (sections preserved)", async () => {
    const seed = await seedMaster("gate_a_pending")
    const res = await submitGateAReview(seed.masterId, { type: "reject", message: "off-topic" })
    expect(res.status).toBe("draft")

    const m = await db.longFormMaster.findUnique({ where: { id: seed.masterId } })
    expect(m?.reviewFeedback).toBe("off-topic")
    // Immutable history: rejecting does not delete the sections.
    expect(await db.longFormSection.count({ where: { longFormMasterId: seed.masterId } })).toBe(2)

    await cleanup(seed)
  })

  it("inline_edit saves edited sections and approves the master", async () => {
    const seed = await seedMaster("gate_a_pending")
    const res = await submitGateAReview(seed.masterId, {
      type: "inline_edit",
      sections: [
        { id: seed.sectionIds[0], heading: "Intro v2", contentMarkdown: "Edited body" },
        { id: seed.sectionIds[1], heading: "Body", contentMarkdown: "Body 2" },
      ],
    })
    expect(res.status).toBe("approved")

    const edited = await db.longFormSection.findUnique({ where: { id: seed.sectionIds[0] } })
    expect(edited?.heading).toBe("Intro v2")
    expect(edited?.contentMarkdown).toBe("Edited body")

    await cleanup(seed)
  })

  it("enforces sovereignty: acting on a non-pending master throws", async () => {
    const seed = await seedMaster("approved")
    await expect(submitGateAReview(seed.masterId, { type: "approve" })).rejects.toThrow()
    // status unchanged
    const m = await db.longFormMaster.findUnique({ where: { id: seed.masterId } })
    expect(m?.status).toBe("approved")
    await cleanup(seed)
  })

  it("getMasterForReview returns ordered sections with nested sources", async () => {
    const seed = await seedMaster("gate_a_pending")
    const m = await getMasterForReview(seed.masterId)
    expect(m?.sections).toHaveLength(2)
    expect(m?.sections[0].order).toBe(1)
    expect(m?.sections[0].sourceRefs[0].researchSource.title).toBe("Source A")

    const list = await listMastersForWorkspace(seed.workspaceId)
    const row = list.find((r) => r.id === seed.masterId)
    expect(row?._count.sections).toBe(2)
    expect(row?._count.researchSources).toBe(1)

    await cleanup(seed)
  })
})
