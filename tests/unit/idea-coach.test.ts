import { describe, it, expect, vi } from "vitest"
import { coachIdeas, ProposalSchema, type CoachInput } from "@/lib/domain/agents/idea-coach"
import type { ModelGateway } from "@/lib/core/models/gateway"

// A gateway whose request() returns the next canned content string each call
// (the last is repeated if more calls happen).
function gatewayReturning(contents: string[]): { gateway: ModelGateway; calls: () => number } {
  let i = 0
  const request = vi.fn(async () => ({
    result: { content: contents[Math.min(i++, contents.length - 1)] },
  }))
  const gateway = {
    request,
    requestMultiple: vi.fn(async () => []),
    getAvailableModels: vi.fn(() => []),
  } as unknown as ModelGateway
  return { gateway, calls: () => request.mock.calls.length }
}

const VALID = JSON.stringify({
  proposals: [
    { title: "Why cross-critique beats tournaments for text", angle: "Synthesis vs selection, with a concrete example." },
    { title: "Loop engines for reliable AI output", angle: "How disciplined loops beat reaching for a bigger model." },
    { title: "Designing human gates that actually matter", angle: "Where approval belongs so quality compounds." },
  ],
})

function baseInput(): CoachInput {
  return {
    umbrella: "Agentic AI development",
    niche: "AI engineering",
    persona: { name: "BuildOS Creator", audienceProfile: {}, voiceTone: {} },
    workspaceId: "ws-1",
  }
}

describe("coachIdeas", () => {
  it("returns 3–5 schema-valid proposals", async () => {
    const { gateway } = gatewayReturning([VALID])
    const result = await coachIdeas(baseInput(), { gateway })
    expect(result.proposals.length).toBeGreaterThanOrEqual(3)
    expect(result.proposals.length).toBeLessThanOrEqual(5)
    for (const p of result.proposals) {
      expect(ProposalSchema.safeParse(p).success).toBe(true)
    }
  })

  it("strips code fences before parsing", async () => {
    const fenced = "```json\n" + VALID + "\n```"
    const { gateway } = gatewayReturning([fenced])
    const result = await coachIdeas(baseInput(), { gateway })
    expect(result.proposals).toHaveLength(3)
  })

  it("runs the repair pass when the first reply is malformed", async () => {
    const { gateway, calls } = gatewayReturning(["not json at all", VALID])
    const result = await coachIdeas(baseInput(), { gateway })
    expect(result.proposals).toHaveLength(3)
    expect(calls()).toBe(2) // first + one repair
  })

  it("throws when still invalid after the repair pass", async () => {
    const { gateway } = gatewayReturning(["nope", "still nope"])
    await expect(coachIdeas(baseInput(), { gateway })).rejects.toThrow()
  })

  it("rejects an out-of-range count (only 2 proposals)", async () => {
    const tooFew = JSON.stringify({
      proposals: [
        { title: "Only one good title here", angle: "Not enough proposals to be useful." },
        { title: "And a second decent title", angle: "Still below the minimum of three." },
      ],
    })
    const { gateway } = gatewayReturning([tooFew, tooFew])
    await expect(coachIdeas(baseInput(), { gateway })).rejects.toThrow()
  })
})
