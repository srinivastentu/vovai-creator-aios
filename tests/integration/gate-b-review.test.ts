// Real-DB integration tests for the CR-11 Gate B review + fork-on-regenerate data
// layer. Seeds a master + artifacts, exercises every review action, the Idea-
// completion rule, fork-on-regenerate (with an injected runner — no model calls),
// the iteration-history read, and cross-user isolation. Skipped cleanly when no
// DATABASE_URL is configured (CI without a DB).
import "dotenv/config"
import { describe, it, expect, beforeAll, vi } from "vitest"

// revalidatePath throws outside a Next request context — stub it.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

// Controllable current user so the cross-user isolation test can flip identities.
const userHolder = vi.hoisted(() => ({ id: "local-user" }))
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserId: () => userHolder.id,
  CURRENT_USER_ID: "local-user",
}))

import type { ArtifactStatus } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { createPersona, deletePersona } from "@/lib/domain/data/personas"
import { createWorkspace, deleteWorkspace } from "@/lib/domain/data/workspaces"
import { createIdea, deleteIdea } from "@/lib/domain/data/ideas"
import { EMPTY_PERSONA } from "@/lib/domain/persona-schema"
import { getArtifactForReview } from "@/lib/domain/data/artifacts"
import { submitGateBReview, regenerateArtifact } from "@/lib/domain/data/artifact-actions"
import type { RegenRunner } from "@/lib/domain/workflows/creator/regenerate-runner"

const hasDb = Boolean(process.env.DATABASE_URL)
const suite = hasDb ? describe : describe.skip

const PARA =
  "This is a concrete sentence about agentic AI loops and the tradeoffs builders actually hit. "
const VALID_LINKEDIN = [
  "Here is a counter-intuitive claim about content generation.",
  "Most teams reach for the wrong loop.",
  "",
  PARA.repeat(11),
  "",
  PARA.repeat(11),
  "",
  "So which loop are you running?",
].join("\n")
const EDITED_LINKEDIN = VALID_LINKEDIN.replace("counter-intuitive", "genuinely surprising")

function linkedinContent(text: string) {
  return { text, charCount: text.length }
}

interface Seed {
  personaId: string
  workspaceId: string
  ideaId: string
  masterId: string
  linkedinId: string
  articleId: string
}

async function seed(opts: { linkedinStatus?: ArtifactStatus; articleStatus?: ArtifactStatus } = {}): Promise<Seed> {
  const persona = await createPersona({ ...EMPTY_PERSONA, name: "GateB Persona" })
  const ws = await createWorkspace({ name: "GateB WS", personaId: persona.id })
  const idea = await createIdea({ workspaceId: ws.id, title: "GateB idea" })
  const master = await db.longFormMaster.create({
    data: { workspaceId: ws.id, ideaId: idea.id, title: "GateB master", status: "approved" },
  })
  const linkedin = await db.artifact.create({
    data: {
      workspaceId: ws.id,
      longFormMasterId: master.id,
      artifactType: "linkedin_post",
      content: linkedinContent(VALID_LINKEDIN),
      derivedVia: "cross_critique",
      bestScore: 91,
      status: opts.linkedinStatus ?? "awaiting_review",
      costUSD: 0.14,
    },
  })
  const article = await db.artifact.create({
    data: {
      workspaceId: ws.id,
      longFormMasterId: master.id,
      artifactType: "long_form_article",
      content: { title: "T", markdown: "# T\n\nbody", wordCount: 2 },
      derivedVia: "cross_critique",
      bestScore: 90,
      status: opts.articleStatus ?? "awaiting_review",
      costUSD: 0.31,
    },
  })
  return {
    personaId: persona.id,
    workspaceId: ws.id,
    ideaId: idea.id,
    masterId: master.id,
    linkedinId: linkedin.id,
    articleId: article.id,
  }
}

async function cleanup(s: Seed) {
  await db.stageSession.deleteMany({ where: { workspaceId: s.workspaceId } })
  await db.artifact.deleteMany({ where: { workspaceId: s.workspaceId } })
  await db.longFormMaster.delete({ where: { id: s.masterId } })
  await deleteIdea(s.ideaId)
  await deleteWorkspace(s.workspaceId)
  await deletePersona(s.personaId)
}

/** A fake regen runner — returns a canned best artifact + one history row, no models. */
const fakeRunner: RegenRunner = async ({ type }) => ({
  stageId: `${type}-cross-critique`,
  best: type === "linkedin_post" ? linkedinContent(VALID_LINKEDIN) : { title: "R", markdown: "# R\n\nx", wordCount: 2 },
  bestScore: 93,
  totalCostUSD: 0.22,
  terminationReason: "threshold_met",
  historyRows: [
    {
      version: 1,
      gradeJson: {
        overallScore: 93,
        passesThreshold: true,
        dimensionScores: [{ dimensionId: "h", name: "Hook", score: 9, weight: 1, feedback: "ok" }],
        recommendation: "ship",
        improvementPriorities: [],
      },
      detailJson: {
        producers: [{ agentId: "producer-claude", snippet: "draft a", size: 1500 }],
        critiques: [{ criticId: "critic", snippet: "tighten" }],
        integratorSnippet: "synthesis",
        judgeSkipped: false,
        producersSucceeded: 2,
      },
      modelUsed: "claude-sonnet-4-20250514",
      tokensIn: 0,
      tokensOut: 0,
      costUSD: 0.22,
    },
  ],
})

suite("CR-11 Gate B review (real DB)", () => {
  beforeAll(async () => {
    await db.user.upsert({
      where: { id: "local-user" },
      update: {},
      create: { id: "local-user", email: "local@creator.os" },
    })
  })

  it("approve locks the artifact to approved and clears any note", async () => {
    const s = await seed()
    const res = await submitGateBReview(s.linkedinId, { type: "approve" })
    expect(res.status).toBe("approved")
    expect(res.ideaCompleted).toBe(false) // article still awaiting

    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(a?.status).toBe("approved")
    expect(a?.reviewedAt).not.toBeNull()
    expect(a?.reviewFeedback).toBeNull()
    await cleanup(s)
  })

  it("feedback persists the note and returns the artifact to draft", async () => {
    const s = await seed()
    const res = await submitGateBReview(s.linkedinId, { type: "feedback", message: "Sharpen the hook" })
    expect(res.status).toBe("draft")
    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(a?.status).toBe("draft")
    expect(a?.reviewFeedback).toBe("Sharpen the hook")
    await cleanup(s)
  })

  it("reject marks the artifact rejected with the reason", async () => {
    const s = await seed()
    const res = await submitGateBReview(s.linkedinId, { type: "reject", message: "off-voice" })
    expect(res.status).toBe("rejected")
    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(a?.status).toBe("rejected")
    expect(a?.reviewFeedback).toBe("off-voice")
    await cleanup(s)
  })

  it("inline_edit saves the rebuilt body in place and approves", async () => {
    const s = await seed()
    const res = await submitGateBReview(s.linkedinId, { type: "inline_edit", content: EDITED_LINKEDIN })
    expect(res.status).toBe("approved")
    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    const content = a?.content as { text: string; charCount: number }
    expect(content.text).toBe(EDITED_LINKEDIN.trim())
    expect(content.charCount).toBe(EDITED_LINKEDIN.trim().length) // recomputed by code
    await cleanup(s)
  })

  it("rejects an inline_edit that breaks the publishable bounds", async () => {
    const s = await seed()
    await expect(
      submitGateBReview(s.linkedinId, { type: "inline_edit", content: "Too short." }),
    ).rejects.toThrow()
    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(a?.status).toBe("awaiting_review") // unchanged
    await cleanup(s)
  })

  it("enforces sovereignty: acting on a non-awaiting artifact throws", async () => {
    const s = await seed({ linkedinStatus: "approved" })
    await expect(submitGateBReview(s.linkedinId, { type: "approve" })).rejects.toThrow()
    await cleanup(s)
  })

  it("completes the Idea when BOTH artifact types are approved", async () => {
    const s = await seed({ articleStatus: "approved" }) // article pre-approved
    const res = await submitGateBReview(s.linkedinId, { type: "approve" })
    expect(res.ideaCompleted).toBe(true)
    const idea = await db.idea.findUnique({ where: { id: s.ideaId } })
    expect(idea?.status).toBe("completed")
    await cleanup(s)
  })

  it("fork-on-regenerate creates an inline_edit seed and a regenerate branch (immutable history)", async () => {
    const s = await seed()
    const { editedArtifactId, regeneratedArtifactId } = await regenerateArtifact(
      s.linkedinId,
      EDITED_LINKEDIN,
      { runner: fakeRunner },
    )

    const edited = await db.artifact.findUnique({ where: { id: editedArtifactId } })
    expect(edited?.derivedVia).toBe("inline_edit")
    expect(edited?.parentArtifactIds).toEqual([s.linkedinId])
    expect(edited?.status).toBe("draft")

    const regen = await db.artifact.findUnique({ where: { id: regeneratedArtifactId } })
    expect(regen?.derivedVia).toBe("regenerate")
    expect(regen?.parentArtifactIds).toEqual([editedArtifactId])
    expect(regen?.status).toBe("awaiting_review")
    expect(regen?.bestScore).toBe(93)

    // Original is untouched (Immutable History).
    const original = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(original?.status).toBe("awaiting_review")
    expect(original?.derivedVia).toBe("cross_critique")

    // The regen run persisted a StageSession + iteration history for A_regen.
    const session = await db.stageSession.findFirst({
      where: { finalArtifactId: regeneratedArtifactId },
      include: { iterationRecords: true },
    })
    expect(session?.terminationReason).toBe("threshold_met")
    expect(session?.iterationRecords).toHaveLength(1)
    await cleanup(s)
  })

  it("getArtifactForReview returns the artifact, its history, and same-type branches", async () => {
    const s = await seed()
    await regenerateArtifact(s.linkedinId, EDITED_LINKEDIN, { runner: fakeRunner })

    const data = await getArtifactForReview(s.linkedinId)
    expect(data?.artifact.id).toBe(s.linkedinId)
    // 3 linkedin branches now: original + A_edited + A_regen; article excluded by type filter elsewhere.
    const linkedinSiblings = data?.siblings.filter((x) => x.artifactType === "linkedin_post")
    expect(linkedinSiblings?.length).toBe(3)
    await cleanup(s)
  })

  it("cross-user isolation: a second user cannot read or mutate the artifact", async () => {
    const s = await seed() // seeded as local-user (userHolder default)
    await db.user.upsert({
      where: { id: "other-user" },
      update: {},
      create: { id: "other-user", email: "other@creator.os" },
    })
    userHolder.id = "other-user"
    try {
      expect(await getArtifactForReview(s.linkedinId)).toBeNull()
      await expect(submitGateBReview(s.linkedinId, { type: "approve" })).rejects.toThrow()
    } finally {
      userHolder.id = "local-user"
    }
    // status unchanged under the rightful owner
    const a = await db.artifact.findUnique({ where: { id: s.linkedinId } })
    expect(a?.status).toBe("awaiting_review")
    await cleanup(s)
  })
})
