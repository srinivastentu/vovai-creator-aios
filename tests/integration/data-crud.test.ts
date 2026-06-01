// Real-DB integration tests for the CR-9 data layer. They run against the
// dev database (DATABASE_URL) and clean up after themselves. Skipped cleanly
// when no DATABASE_URL is configured (e.g. CI without a database).
import "dotenv/config"
import { describe, it, expect, beforeAll, vi } from "vitest"

// revalidatePath throws outside a Next request context — stub it.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

import { db } from "@/lib/db"
import {
  createPersona,
  getPersona,
  updatePersona,
  deletePersona,
} from "@/lib/domain/data/personas"
import {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaces,
} from "@/lib/domain/data/workspaces"
import {
  createIdea,
  listIdeas,
  updateIdea,
  deleteIdea,
} from "@/lib/domain/data/ideas"
import { EMPTY_PERSONA } from "@/lib/domain/persona-schema"

const hasDb = Boolean(process.env.DATABASE_URL)
const suite = hasDb ? describe : describe.skip

suite("CR-9 data layer (real DB, user-scoped)", () => {
  beforeAll(async () => {
    // The hardcoded local user must exist for the FK on persona/workspace.
    await db.user.upsert({
      where: { id: "local-user" },
      update: {},
      create: { id: "local-user", email: "local@creator.os" },
    })
  })

  it("persona round-trips (create → get → update → delete)", async () => {
    const created = await createPersona({ ...EMPTY_PERSONA, name: "CR9 Test Persona", niches: ["AI"] })
    expect(created.id).toBeTruthy()

    const fetched = await getPersona(created.id)
    expect(fetched?.name).toBe("CR9 Test Persona")

    const updated = await updatePersona(created.id, { ...EMPTY_PERSONA, name: "CR9 Renamed", niches: ["AI"] })
    expect(updated?.name).toBe("CR9 Renamed")

    await deletePersona(created.id)
    expect(await getPersona(created.id)).toBeNull()
  })

  it("workspace round-trips and joins the persona in the list", async () => {
    const persona = await createPersona({ ...EMPTY_PERSONA, name: "CR9 WS Persona" })
    const ws = await createWorkspace({ name: "CR9 Test WS", personaId: persona.id, niches: ["AI"] })
    expect(ws.id).toBeTruthy()

    expect((await getWorkspace(ws.id))?.name).toBe("CR9 Test WS")

    const renamed = await updateWorkspace(ws.id, { name: "CR9 WS Renamed" })
    expect(renamed?.name).toBe("CR9 WS Renamed")

    const inList = (await listWorkspaces()).find((w) => w.id === ws.id)
    expect(inList?.persona.name).toBe("CR9 WS Persona")
    expect(inList?._count.ideas).toBe(0)

    await deleteWorkspace(ws.id)
    expect(await getWorkspace(ws.id)).toBeNull()
    await deletePersona(persona.id)
  })

  it("idea round-trips with a status transition", async () => {
    const persona = await createPersona({ ...EMPTY_PERSONA, name: "CR9 Idea Persona" })
    const ws = await createWorkspace({ name: "CR9 Idea WS", personaId: persona.id })

    const idea = await createIdea({ workspaceId: ws.id, title: "CR9 idea", niches: ["AI"] })
    expect(idea.status).toBe("captured")

    const updated = await updateIdea(idea.id, { status: "in_progress" })
    expect(updated?.status).toBe("in_progress")

    await deleteIdea(idea.id)
    expect((await listIdeas(ws.id)).find((i) => i.id === idea.id)).toBeUndefined()

    await deleteWorkspace(ws.id)
    await deletePersona(persona.id)
  })

  it("filters by status, by niche, and the intersection of both", async () => {
    const persona = await createPersona({ ...EMPTY_PERSONA, name: "CR9 Filter Persona" })
    const ws = await createWorkspace({ name: "CR9 Filter WS", personaId: persona.id })

    const a = await createIdea({ workspaceId: ws.id, title: "AI one", niches: ["AI"], status: "captured" })
    const b = await createIdea({ workspaceId: ws.id, title: "Robotics one", niches: ["Robotics"], status: "in_progress" })
    const c = await createIdea({ workspaceId: ws.id, title: "AI two", niches: ["AI", "Robotics"], status: "captured" })

    const captured = await listIdeas(ws.id, { status: "captured" })
    expect(captured.map((i) => i.id).sort()).toEqual([a.id, c.id].sort())

    const ai = await listIdeas(ws.id, { niche: "AI" })
    expect(ai.map((i) => i.id).sort()).toEqual([a.id, c.id].sort())

    const both = await listIdeas(ws.id, { status: "captured", niche: "Robotics" })
    expect(both.map((i) => i.id)).toEqual([c.id])

    const search = await listIdeas(ws.id, { q: "robotics one" })
    expect(search.map((i) => i.id)).toEqual([b.id])

    for (const i of [a, b, c]) await deleteIdea(i.id)
    await deleteWorkspace(ws.id)
    await deletePersona(persona.id)
  })
})
