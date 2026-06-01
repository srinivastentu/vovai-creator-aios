import { describe, it, expect } from "vitest"
import type { ReviewArtifact } from "@/components/review/artifact-types"
import type { ReviewMaster } from "@/components/review/types"
import {
  governanceFromArtifact,
  governanceFromMaster,
  STAGE_THRESHOLD,
} from "@/components/shell/governance"

function artifact(overrides: Partial<ReviewArtifact> = {}): ReviewArtifact {
  return {
    id: "a1",
    workspaceId: "ws1",
    workspaceName: "WS",
    masterTitle: "Master",
    ideaTitle: "Idea",
    ideaStatus: "in_progress",
    artifactType: "linkedin_post",
    status: "awaiting_review",
    derivedVia: "cross_critique",
    bestScore: 91.3,
    costUSD: 0.1538,
    reviewFeedback: null,
    body: "Post body",
    iterationCount: 2,
    terminationReason: "threshold_met",
    iterations: [
      {
        version: 1,
        score: 88,
        dimensions: [],
        producers: [
          { agentId: "claude-producer", snippet: "", size: 10 },
          { agentId: "gpt-producer", snippet: "", size: 10 },
        ],
        critiques: [],
        integratorSnippet: null,
        judgeSkipped: false,
        producersSucceeded: 2,
        costUSD: 0.07,
      },
      {
        version: 2,
        score: 91.3,
        dimensions: [],
        producers: [
          { agentId: "claude-producer", snippet: "", size: 10 },
          { agentId: "gpt-producer", snippet: "", size: 10 },
        ],
        critiques: [],
        integratorSnippet: null,
        judgeSkipped: false,
        producersSucceeded: 2,
        costUSD: 0.08,
      },
    ],
    branches: [],
    ...overrides,
  }
}

describe("governanceFromArtifact", () => {
  it("shapes the ribbon from existing view-model fields", () => {
    const g = governanceFromArtifact(artifact())
    expect(g.deterministic).toBe(false)
    expect(g.versionLabel).toBe("v2 · LinkedIn post")
    expect(g.modelLineage).toEqual(["Claude", "GPT-4o", "Gemini judge"])
    expect(g.score).toBe(91.3)
    expect(g.threshold).toBe(STAGE_THRESHOLD)
    expect(g.iterations).toBe(2)
    expect(g.costUSD).toBeCloseTo(0.1538)
    expect(g.approval).toBe("in_review")
  })

  it("maps status + feedback to approval state", () => {
    expect(governanceFromArtifact(artifact({ status: "approved" })).approval).toBe("approved")
    expect(governanceFromArtifact(artifact({ status: "rejected" })).approval).toBe("rejected")
    expect(
      governanceFromArtifact(artifact({ status: "draft", reviewFeedback: "tighten the hook" })).approval,
    ).toBe("changes_requested")
  })

  it("accepts a threshold + audit href override and labels articles", () => {
    const g = governanceFromArtifact(artifact({ artifactType: "long_form_article" }), {
      threshold: 75,
      auditHref: "/audit",
    })
    expect(g.versionLabel).toBe("v2 · Long-form article")
    expect(g.threshold).toBe(75)
    expect(g.auditHref).toBe("/audit")
  })
})

describe("governanceFromMaster", () => {
  function master(overrides: Partial<ReviewMaster> = {}): ReviewMaster {
    return {
      id: "m1",
      workspaceId: "ws1",
      workspaceName: "WS",
      title: "Master",
      status: "gate_a_pending",
      reviewFeedback: null,
      ideaTitle: "Idea",
      sections: [],
      ...overrides,
    }
  }

  it("is deterministic: no score, iterations, or lineage", () => {
    const g = governanceFromMaster(master())
    expect(g.deterministic).toBe(true)
    expect(g.score).toBeNull()
    expect(g.iterations).toBeNull()
    expect(g.modelLineage).toEqual([])
    expect(g.approval).toBe("in_review")
  })

  it("maps master status to approval", () => {
    expect(governanceFromMaster(master({ status: "approved" })).approval).toBe("approved")
    expect(governanceFromMaster(master({ status: "in_repurpose" })).approval).toBe("approved")
    expect(
      governanceFromMaster(master({ status: "draft", reviewFeedback: "add a section" })).approval,
    ).toBe("changes_requested")
  })
})
