import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the gateway the Idea Coach agent resolves, plus the user-scoped data
// loaders the route calls — so the route test needs no DB and no real model.
const gw = { contents: [] as string[], calls: 0 }

vi.mock("@/lib/core/models/default-gateway", () => ({
  getDefaultGateway: () => ({
    request: async () => ({
      result: { content: gw.contents[Math.min(gw.calls++, gw.contents.length - 1)] },
    }),
    requestMultiple: async () => [],
    getAvailableModels: () => [],
  }),
}))

vi.mock("@/lib/domain/data/workspaces", () => ({
  getWorkspace: vi.fn(async () => ({ id: "ws", personaId: "p" })),
}))
vi.mock("@/lib/domain/data/personas", () => ({
  getPersona: vi.fn(async () => ({ name: "BuildOS", audienceProfile: {}, voiceTone: {} })),
}))

import { POST } from "@/app/api/workspaces/[id]/ideas/coach/route"

const VALID = JSON.stringify({
  proposals: [
    { title: "Why cross-critique beats tournaments", angle: "Synthesis over selection, shown concretely." },
    { title: "Loop engines for reliable AI output", angle: "Disciplined loops over a bigger model." },
    { title: "Human gates that actually matter", angle: "Where approval belongs so quality compounds." },
  ],
})

function makeReq(body: unknown) {
  return new Request("http://localhost/api/workspaces/ws/ideas/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}
const ctx = { params: Promise.resolve({ id: "ws" }) }

beforeEach(() => {
  gw.calls = 0
  gw.contents = []
})

describe("POST /api/workspaces/[id]/ideas/coach", () => {
  it("400 on an invalid body", async () => {
    const res = await POST(makeReq({ umbrella: "", niche: "" }), ctx)
    expect(res.status).toBe(400)
  })

  it("200 with 3–5 proposals on a valid generation", async () => {
    gw.contents = [VALID]
    const res = await POST(makeReq({ umbrella: "Agentic AI", niche: "AI engineering" }), ctx)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { proposals: { title: string; angle: string }[] }
    expect(json.proposals.length).toBeGreaterThanOrEqual(3)
    expect(json.proposals.length).toBeLessThanOrEqual(5)
  })

  it("200 after the agent's repair pass recovers a malformed first reply", async () => {
    gw.contents = ["garbage, not json", VALID]
    const res = await POST(makeReq({ umbrella: "Agentic AI", niche: "AI engineering" }), ctx)
    expect(res.status).toBe(200)
  })

  it("422 when generation stays malformed through the repair pass", async () => {
    gw.contents = ["bad", "still bad"]
    const res = await POST(makeReq({ umbrella: "Agentic AI", niche: "AI engineering" }), ctx)
    expect(res.status).toBe(422)
  })
})
