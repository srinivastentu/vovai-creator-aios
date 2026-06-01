import { describe, it, expect } from "vitest"
import type {
  CrossCritiqueIterationRecord,
  GradeReport,
} from "../../../src/lib/core/engine/types"
import {
  buildIterationHistoryRows,
  rebuildArtifactContent,
  bothArtifactTypesApproved,
  editForkSpec,
  regenForkSpec,
  V1_ARTIFACT_TYPES,
} from "../../../src/lib/domain/workflows/creator/repurpose-persistence"
import type {
  ArticleArtifact,
  LinkedInArtifact,
} from "../../../src/lib/domain/workflows/creator/types"

// ─── Fixtures ───────────────────────────────────────────────────────────────────

function grade(score: number): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= 80,
    dimensionScores: [
      { dimensionId: "hook", name: "Hook", score: 9, weight: 0.5, feedback: "strong" },
      { dimensionId: "voice", name: "Voice", score: 8, weight: 0.5, feedback: "ok" },
    ],
    recommendation: "ship",
    improvementPriorities: [],
  }
}

const linkedinPreview = (a: LinkedInArtifact) => ({ text: a.text, size: a.charCount })

function ccRecord(
  over: Partial<CrossCritiqueIterationRecord> = {},
): CrossCritiqueIterationRecord {
  const producerArtifacts: Record<string, LinkedInArtifact> = {
    "producer-claude": { text: "Claude draft about agentic loops", charCount: 31 },
    "producer-gpt": { text: "GPT draft about the same idea", charCount: 29 },
  }
  return {
    artifactId: "stage-cc-v1",
    version: 1,
    grade: grade(88),
    modelUsed: "claude-sonnet-4-20250514",
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0.12,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    producerArtifacts,
    critiques: {
      "critic-claude-on-gpt": "GPT draft buries the hook in line 4.",
      "critic-gpt-on-claude": "Claude draft is dense; add a break.",
    },
    integratedArtifact: { text: "Integrated best-of-both post.", charCount: 29 },
    judgeGrade: grade(88),
    iterationCostUSD: 0.12,
    producersSucceeded: 2,
    ...over,
  }
}

// ─── buildIterationHistoryRows ──────────────────────────────────────────────────

describe("buildIterationHistoryRows", () => {
  it("maps each record into an IterationRecord row with cross-critique detail", () => {
    const rows = buildIterationHistoryRows<LinkedInArtifact>(
      [ccRecord()],
      linkedinPreview,
      "claude-sonnet-4-20250514",
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.version).toBe(1)
    expect(r.gradeJson?.overallScore).toBe(88)
    expect(r.modelUsed).toBe("claude-sonnet-4-20250514")
    expect(r.costUSD).toBeCloseTo(0.12, 5)
    expect(r.detailJson.producers.map((p) => p.agentId)).toEqual([
      "producer-claude",
      "producer-gpt",
    ])
    expect(r.detailJson.critiques.map((c) => c.criticId)).toEqual([
      "critic-claude-on-gpt",
      "critic-gpt-on-claude",
    ])
    expect(r.detailJson.integratorSnippet).toContain("Integrated best-of-both")
    expect(r.detailJson.judgeSkipped).toBe(false)
    expect(r.detailJson.producersSucceeded).toBe(2)
  })

  it("flags a skipped judge and a null integrator (graceful degradation)", () => {
    const rows = buildIterationHistoryRows<LinkedInArtifact>(
      [ccRecord({ judgeGrade: null, grade: null, integratedArtifact: null, producersSucceeded: 1 })],
      linkedinPreview,
      "claude-sonnet-4-20250514",
    )
    expect(rows[0].gradeJson).toBeNull()
    expect(rows[0].detailJson.judgeSkipped).toBe(true)
    expect(rows[0].detailJson.integratorSnippet).toBeNull()
    expect(rows[0].detailJson.producersSucceeded).toBe(1)
  })

  it("clips long snippets to the configured length", () => {
    const long = "word ".repeat(200)
    const rows = buildIterationHistoryRows<LinkedInArtifact>(
      [ccRecord({ producerArtifacts: { a: { text: long, charCount: long.length } } })],
      linkedinPreview,
      "m",
      40,
    )
    expect(rows[0].detailJson.producers[0].snippet.length).toBeLessThanOrEqual(41) // 40 + ellipsis
    expect(rows[0].detailJson.producers[0].snippet.endsWith("…")).toBe(true)
  })
})

// ─── rebuildArtifactContent ─────────────────────────────────────────────────────

describe("rebuildArtifactContent", () => {
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

  it("recomputes charCount for a LinkedIn edit and re-validates", () => {
    const { content, validation } = rebuildArtifactContent("linkedin_post", VALID_LINKEDIN, "ignored")
    const li = content as LinkedInArtifact
    expect(li.charCount).toBe(VALID_LINKEDIN.trim().length)
    expect(validation.valid).toBe(true)
  })

  it("surfaces validation errors for an out-of-bounds LinkedIn edit", () => {
    const { validation } = rebuildArtifactContent("linkedin_post", "Too short.\n\nStill short.", "x")
    expect(validation.valid).toBe(false)
    expect(validation.errors.map((e) => e.code)).toContain("too_short")
  })

  it("re-derives an article title from the body H1 and recomputes wordCount", () => {
    const SENT =
      "Sequential cross critique synthesizes strengths across producers while tournament selection discards losers entirely. "
    const md = [
      "# Why Sequential Cross-Critique Wins",
      "",
      "This intro runs well over twenty-five words because it must clear the intro gate and frame the central tension before any heading appears, explaining plainly why the loop choice matters for builders shipping real systems today.",
      "",
      "## The Architecture Gap",
      SENT.repeat(45),
      "",
      "## How It Works",
      SENT.repeat(45),
      "",
      "## The Takeaway",
      `${SENT.repeat(4)} The upshot is clear.`,
    ].join("\n")
    const { content, validation } = rebuildArtifactContent("long_form_article", md, "Fallback")
    const art = content as ArticleArtifact
    expect(art.title).toBe("Why Sequential Cross-Critique Wins")
    expect(art.wordCount).toBeGreaterThanOrEqual(1200)
    expect(validation.valid).toBe(true)
  })

  it("falls back to the supplied title when the article body has no H1", () => {
    const { content } = rebuildArtifactContent("long_form_article", "no heading here", "Fallback Title")
    expect((content as ArticleArtifact).title).toBe("Fallback Title")
  })
})

// ─── bothArtifactTypesApproved ──────────────────────────────────────────────────

describe("bothArtifactTypesApproved", () => {
  it("requires an approved artifact of EVERY V1 type", () => {
    expect(V1_ARTIFACT_TYPES).toEqual(["linkedin_post", "long_form_article"])
    expect(
      bothArtifactTypesApproved([
        { artifactType: "linkedin_post", status: "approved" },
        { artifactType: "long_form_article", status: "approved" },
      ]),
    ).toBe(true)
  })

  it("is false when one type is not yet approved", () => {
    expect(
      bothArtifactTypesApproved([
        { artifactType: "linkedin_post", status: "approved" },
        { artifactType: "long_form_article", status: "awaiting_review" },
      ]),
    ).toBe(false)
  })

  it("is false when only one type exists", () => {
    expect(
      bothArtifactTypesApproved([{ artifactType: "linkedin_post", status: "approved" }]),
    ).toBe(false)
  })

  it("counts a type as approved if ANY of its artifacts (branches) is approved", () => {
    expect(
      bothArtifactTypesApproved([
        { artifactType: "linkedin_post", status: "rejected" },
        { artifactType: "linkedin_post", status: "approved" }, // a later branch
        { artifactType: "long_form_article", status: "approved" },
      ]),
    ).toBe(true)
  })
})

// ─── Fork lineage (Immutable History) ───────────────────────────────────────────

describe("editForkSpec / regenForkSpec", () => {
  it("the edit fork is an inline_edit draft parented to the edited artifact", () => {
    expect(editForkSpec("art-best")).toEqual({
      derivedVia: "inline_edit",
      parentArtifactIds: ["art-best"],
      status: "draft",
    })
  })

  it("the regen fork is a regenerate artifact parented to the edit fork, awaiting review", () => {
    expect(regenForkSpec("art-edited")).toEqual({
      derivedVia: "regenerate",
      parentArtifactIds: ["art-edited"],
      status: "awaiting_review",
    })
  })
})
