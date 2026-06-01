// Gate A (Long-Form Master) review semantics — CreatorOS V1.
//
// The Core Loop Engine retains all 6 review actions (src/lib/core/review).
// Gate A in V1 reviews a *persisted* LongFormMaster, not a live LoopState —
// Stage 3 synthesis is CLI-driven in V1, so there is no in-memory loop state to
// hand to core/processReview. This domain module therefore mirrors the Core
// review *principles* — allowed-action gating + human sovereignty — over the
// MasterStatus lifecycle, rather than routing through the Core engine.
//
// TODO(V2): when Stage 3 runs live in-UI, reconstruct a LoopState<LongFormMaster>
// and route Gate A through core/review processReview so the two share one path.
//
// Pure logic only: no Prisma client, no I/O. The data layer (data/masters.ts)
// applies the transition + persists the note. Keeps this unit-testable in
// isolation.

import type { MasterStatus } from "@/generated/prisma/client"

// V1 UI surfaces 4 of the engine's 6 review actions at Gate A.
// TODO(V2): surface use_segments + mix_produce actions.
// The engine processes them; only the UI is gated.
export type GateAActionType = "approve" | "feedback" | "reject" | "inline_edit"

export const GATE_A_ALLOWED_ACTIONS: readonly GateAActionType[] = [
  "approve",
  "feedback",
  "reject",
  "inline_edit",
] as const

export interface GateAEditedSection {
  id: string
  heading: string
  contentMarkdown: string
}

export type GateAReviewAction =
  | { type: "approve" }
  | { type: "feedback"; message: string }
  | { type: "reject"; message?: string }
  | { type: "inline_edit"; sections: GateAEditedSection[]; message?: string }

export interface GateAReviewError {
  code:
    | "action_not_allowed"
    | "not_awaiting_review"
    | "feedback_message_required"
    | "no_edits"
    | "blank_section"
  message: string
}

// Human sovereignty: a master may only be acted on at Gate A while it is
// awaiting review (gate_a_pending). Mirrors core/review enforceHumanSovereignty —
// no approval (or any gate action) is valid outside the awaiting-review state.
export const REVIEWABLE_STATUS: MasterStatus = "gate_a_pending"

/**
 * Validate a Gate A action against the master's current status.
 * Returns null when the action is valid, or a structured error otherwise.
 */
export function validateGateAReview(
  action: GateAReviewAction,
  currentStatus: MasterStatus,
): GateAReviewError | null {
  if (!GATE_A_ALLOWED_ACTIONS.includes(action.type)) {
    return {
      code: "action_not_allowed",
      message: `Action "${action.type}" is not surfaced at Gate A.`,
    }
  }

  if (currentStatus !== REVIEWABLE_STATUS) {
    return {
      code: "not_awaiting_review",
      message: `Master is "${currentStatus}", not awaiting review; cannot ${action.type}.`,
    }
  }

  if (action.type === "feedback" && action.message.trim().length === 0) {
    return {
      code: "feedback_message_required",
      message: "Request changes requires a message describing what to revise.",
    }
  }

  if (action.type === "inline_edit") {
    if (action.sections.length === 0) {
      return { code: "no_edits", message: "Inline edit requires at least one section." }
    }
    const blank = action.sections.find(
      (s) => s.heading.trim().length === 0 || s.contentMarkdown.trim().length === 0,
    )
    if (blank) {
      return {
        code: "blank_section",
        message: "Every edited section needs a heading and content.",
      }
    }
  }

  return null
}

/**
 * The MasterStatus the master transitions to after a valid Gate A action.
 * - approve / inline_edit → approved (inline_edit is implicit approval; the
 *   edited sections are the final, accepted version).
 * - feedback / reject     → draft  (the master leaves the review queue, flagged
 *   for CLI re-synthesis; the reviewer's note is persisted on the master).
 */
export function resolveGateATransition(action: GateAReviewAction): MasterStatus {
  switch (action.type) {
    case "approve":
    case "inline_edit":
      return "approved"
    case "feedback":
    case "reject":
      return "draft"
  }
}

/**
 * The reviewer note to persist for this action (null when the action carries
 * no note — i.e. a plain approve, or an inline_edit without an accompanying
 * comment). Approve clears any prior note; feedback/reject/edit-with-note set it.
 */
export function resolveReviewFeedback(action: GateAReviewAction): string | null {
  switch (action.type) {
    case "approve":
      return null
    case "feedback":
      return action.message.trim()
    case "reject":
      return action.message?.trim() ? action.message.trim() : null
    case "inline_edit":
      return action.message?.trim() ? action.message.trim() : null
  }
}
