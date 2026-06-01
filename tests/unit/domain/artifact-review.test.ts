import { describe, it, expect } from "vitest"
import type { ArtifactStatus } from "../../../src/generated/prisma/client"
import {
  GATE_B_ALLOWED_ACTIONS,
  REVIEWABLE_ARTIFACT_STATUS,
  validateGateBReview,
  resolveGateBTransition,
  resolveArtifactReviewFeedback,
  type GateBReviewAction,
} from "../../../src/lib/domain/workflows/creator/review/artifact-review"

// Gate B reviews a persisted Artifact (sibling of master-review). These tests pin
// the two invariants the action plan + review-system-v1.md require: (1) only 4 of
// the engine's 6 actions are surfaced, and (2) human sovereignty — gate actions are
// valid only while the artifact is awaiting review.

describe("GATE_B_ALLOWED_ACTIONS", () => {
  it("surfaces exactly the 4 V1 actions", () => {
    expect([...GATE_B_ALLOWED_ACTIONS].sort()).toEqual(
      ["approve", "feedback", "inline_edit", "reject"].sort(),
    )
  })

  it("does NOT surface the two V2-gated engine actions", () => {
    expect(GATE_B_ALLOWED_ACTIONS).not.toContain("use_segments")
    expect(GATE_B_ALLOWED_ACTIONS).not.toContain("mix_produce")
  })
})

describe("validateGateBReview — human sovereignty", () => {
  const approve: GateBReviewAction = { type: "approve" }

  it("allows approve while awaiting review", () => {
    expect(validateGateBReview(approve, REVIEWABLE_ARTIFACT_STATUS)).toBeNull()
    expect(REVIEWABLE_ARTIFACT_STATUS).toBe("awaiting_review")
  })

  it.each<ArtifactStatus>(["draft", "approved", "rejected"])(
    "rejects approve when status is %s (not awaiting review)",
    (status) => {
      const err = validateGateBReview(approve, status)
      expect(err?.code).toBe("not_awaiting_review")
    },
  )

  it("rejects an engine action that is not surfaced at Gate B", () => {
    const action = { type: "use_segments" } as unknown as GateBReviewAction
    const err = validateGateBReview(action, "awaiting_review")
    expect(err?.code).toBe("action_not_allowed")
  })
})

describe("validateGateBReview — per-action validation", () => {
  it("requires a non-empty message for feedback", () => {
    expect(validateGateBReview({ type: "feedback", message: "   " }, "awaiting_review")?.code).toBe(
      "feedback_message_required",
    )
    expect(
      validateGateBReview({ type: "feedback", message: "Sharpen the hook" }, "awaiting_review"),
    ).toBeNull()
  })

  it("allows reject with or without a reason", () => {
    expect(validateGateBReview({ type: "reject" }, "awaiting_review")).toBeNull()
    expect(
      validateGateBReview({ type: "reject", message: "Off-voice" }, "awaiting_review"),
    ).toBeNull()
  })

  it("rejects an inline_edit with empty content", () => {
    expect(
      validateGateBReview({ type: "inline_edit", content: "   " }, "awaiting_review")?.code,
    ).toBe("empty_content")
  })

  it("accepts a well-formed inline_edit", () => {
    expect(
      validateGateBReview({ type: "inline_edit", content: "Edited post body." }, "awaiting_review"),
    ).toBeNull()
  })
})

describe("resolveGateBTransition", () => {
  it("approve and inline_edit lock the artifact to approved", () => {
    expect(resolveGateBTransition({ type: "approve" })).toBe("approved")
    expect(resolveGateBTransition({ type: "inline_edit", content: "x" })).toBe("approved")
  })

  it("feedback returns the artifact to draft (CLI re-produce)", () => {
    expect(resolveGateBTransition({ type: "feedback", message: "fix it" })).toBe("draft")
  })

  it("reject marks the artifact rejected", () => {
    expect(resolveGateBTransition({ type: "reject" })).toBe("rejected")
  })
})

describe("resolveArtifactReviewFeedback", () => {
  it("approve clears the note (null)", () => {
    expect(resolveArtifactReviewFeedback({ type: "approve" })).toBeNull()
  })

  it("feedback persists the trimmed message", () => {
    expect(resolveArtifactReviewFeedback({ type: "feedback", message: "  tighten  " })).toBe(
      "tighten",
    )
  })

  it("reject persists the reason when present, else null", () => {
    expect(resolveArtifactReviewFeedback({ type: "reject", message: "off-topic" })).toBe("off-topic")
    expect(resolveArtifactReviewFeedback({ type: "reject" })).toBeNull()
  })

  it("inline_edit persists an accompanying note when present", () => {
    expect(
      resolveArtifactReviewFeedback({ type: "inline_edit", content: "x", message: "polished hook" }),
    ).toBe("polished hook")
    expect(resolveArtifactReviewFeedback({ type: "inline_edit", content: "x" })).toBeNull()
  })
})
