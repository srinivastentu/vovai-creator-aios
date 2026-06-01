import { describe, it, expect } from "vitest"
import type { MasterStatus } from "../../../src/generated/prisma/client"
import {
  GATE_A_ALLOWED_ACTIONS,
  REVIEWABLE_STATUS,
  validateGateAReview,
  resolveGateATransition,
  resolveReviewFeedback,
  type GateAReviewAction,
} from "../../../src/lib/domain/workflows/creator/review/master-review"

// Gate A reviews a persisted LongFormMaster. These tests pin the two invariants
// the action plan + review-system-v1.md require: (1) only 4 of the engine's 6
// actions are surfaced, and (2) human sovereignty — gate actions are valid only
// while the master is awaiting review (gate_a_pending).

describe("GATE_A_ALLOWED_ACTIONS", () => {
  it("surfaces exactly the 4 V1 actions", () => {
    expect([...GATE_A_ALLOWED_ACTIONS].sort()).toEqual(
      ["approve", "feedback", "inline_edit", "reject"].sort(),
    )
  })

  it("does NOT surface the two V2-gated engine actions", () => {
    expect(GATE_A_ALLOWED_ACTIONS).not.toContain("use_segments")
    expect(GATE_A_ALLOWED_ACTIONS).not.toContain("mix_produce")
  })
})

describe("validateGateAReview — human sovereignty", () => {
  const approve: GateAReviewAction = { type: "approve" }

  it("allows approve while awaiting review", () => {
    expect(validateGateAReview(approve, REVIEWABLE_STATUS)).toBeNull()
    expect(REVIEWABLE_STATUS).toBe("gate_a_pending")
  })

  it.each<MasterStatus>(["draft", "approved", "in_repurpose"])(
    "rejects approve when status is %s (not awaiting review)",
    (status) => {
      const err = validateGateAReview(approve, status)
      expect(err?.code).toBe("not_awaiting_review")
    },
  )

  it("rejects an engine action that is not surfaced at Gate A", () => {
    // use_segments is a real engine action but gated out of the V1 UI.
    const action = { type: "use_segments" } as unknown as GateAReviewAction
    const err = validateGateAReview(action, "gate_a_pending")
    expect(err?.code).toBe("action_not_allowed")
  })
})

describe("validateGateAReview — per-action validation", () => {
  it("requires a non-empty message for feedback", () => {
    expect(validateGateAReview({ type: "feedback", message: "   " }, "gate_a_pending")?.code).toBe(
      "feedback_message_required",
    )
    expect(
      validateGateAReview({ type: "feedback", message: "Tighten section 2" }, "gate_a_pending"),
    ).toBeNull()
  })

  it("allows reject with or without a reason", () => {
    expect(validateGateAReview({ type: "reject" }, "gate_a_pending")).toBeNull()
    expect(
      validateGateAReview({ type: "reject", message: "Off-topic" }, "gate_a_pending"),
    ).toBeNull()
  })

  it("requires at least one section for inline_edit", () => {
    expect(
      validateGateAReview({ type: "inline_edit", sections: [] }, "gate_a_pending")?.code,
    ).toBe("no_edits")
  })

  it("rejects an inline_edit with a blank heading or content", () => {
    const blankHeading: GateAReviewAction = {
      type: "inline_edit",
      sections: [{ id: "s1", heading: "  ", contentMarkdown: "ok" }],
    }
    const blankBody: GateAReviewAction = {
      type: "inline_edit",
      sections: [{ id: "s1", heading: "Intro", contentMarkdown: "" }],
    }
    expect(validateGateAReview(blankHeading, "gate_a_pending")?.code).toBe("blank_section")
    expect(validateGateAReview(blankBody, "gate_a_pending")?.code).toBe("blank_section")
  })

  it("accepts a well-formed inline_edit", () => {
    const action: GateAReviewAction = {
      type: "inline_edit",
      sections: [{ id: "s1", heading: "Intro", contentMarkdown: "Revised body." }],
    }
    expect(validateGateAReview(action, "gate_a_pending")).toBeNull()
  })
})

describe("resolveGateATransition", () => {
  it("approve and inline_edit lock the master to approved", () => {
    expect(resolveGateATransition({ type: "approve" })).toBe("approved")
    expect(
      resolveGateATransition({
        type: "inline_edit",
        sections: [{ id: "s1", heading: "h", contentMarkdown: "c" }],
      }),
    ).toBe("approved")
  })

  it("feedback and reject send the master back to draft", () => {
    expect(resolveGateATransition({ type: "feedback", message: "fix it" })).toBe("draft")
    expect(resolveGateATransition({ type: "reject" })).toBe("draft")
  })
})

describe("resolveReviewFeedback", () => {
  it("approve clears the note (null)", () => {
    expect(resolveReviewFeedback({ type: "approve" })).toBeNull()
  })

  it("feedback persists the trimmed message", () => {
    expect(resolveReviewFeedback({ type: "feedback", message: "  fix the hook  " })).toBe(
      "fix the hook",
    )
  })

  it("reject persists the reason when present, else null", () => {
    expect(resolveReviewFeedback({ type: "reject", message: "off-topic" })).toBe("off-topic")
    expect(resolveReviewFeedback({ type: "reject" })).toBeNull()
  })

  it("inline_edit persists an accompanying note when present", () => {
    expect(
      resolveReviewFeedback({
        type: "inline_edit",
        sections: [{ id: "s1", heading: "h", contentMarkdown: "c" }],
        message: "tightened intro",
      }),
    ).toBe("tightened intro")
  })
})
