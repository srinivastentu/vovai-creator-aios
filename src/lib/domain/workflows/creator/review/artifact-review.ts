// Gate B (Artifact) review semantics — CreatorOS V1.
//
// The sibling of master-review.ts (Gate A). Gate B reviews a *persisted* Artifact
// produced by the Stage-5 cross-critique loop (CLI-driven in V1), so — like Gate A
// — there is no live LoopState to hand to core/processReview; this module mirrors
// the Core review *principles* (allowed-action gating + human sovereignty) over the
// ArtifactStatus lifecycle as pure logic (no Prisma, no I/O). The data layer
// (data/artifact-actions.ts) applies the transition + persists the note.
//
// TODO(V2): when Stage 5 runs live in-UI, reconstruct a LoopState<RepurposeArtifact>
// and route Gate B through core/review processReview so the two gates share one path.
//
// Four of the engine's six review actions are surfaced here (mirrors Gate A).
// Regenerate is NOT one of them: it is a fork operation (it spawns new Artifact
// rows via a fresh cross-critique run), handled in the data layer, not a status
// transition on the current artifact. See review-system-v1.md.

import type { ArtifactStatus } from "@/generated/prisma/client"

// V1 UI surfaces 4 of the engine's 6 review actions at Gate B.
// TODO(V2): surface use_segments + mix_produce actions.
// The engine processes them; only the UI is gated.
export type GateBActionType = "approve" | "feedback" | "reject" | "inline_edit"

export const GATE_B_ALLOWED_ACTIONS: readonly GateBActionType[] = [
  "approve",
  "feedback",
  "reject",
  "inline_edit",
] as const

export type GateBReviewAction =
  | { type: "approve" }
  | { type: "feedback"; message: string }
  | { type: "reject"; message?: string }
  // inline_edit carries the FULL edited artifact body (LinkedIn text / article
  // markdown). Unlike Gate A (which mutates per-section), a Gate B artifact is a
  // single body — implicit approval, mutated in place (the original's pre-edit
  // versions live in the iteration history; Regenerate is the explicit fork path).
  | { type: "inline_edit"; content: string; message?: string }

export interface GateBReviewError {
  code:
    | "action_not_allowed"
    | "not_awaiting_review"
    | "feedback_message_required"
    | "empty_content"
  message: string
}

// Human sovereignty: an artifact may only be acted on at Gate B while it is
// awaiting review. Mirrors core/review enforceHumanSovereignty / Gate A's
// REVIEWABLE_STATUS — no approval (or any gate action) is valid outside it.
export const REVIEWABLE_ARTIFACT_STATUS: ArtifactStatus = "awaiting_review"

/**
 * Validate a Gate B action against the artifact's current status.
 * Returns null when the action is valid, or a structured error otherwise.
 * (Content-shape validation — length bounds, structure — is the deterministic
 * artifact validator's job; the data layer runs it on the rebuilt content.)
 */
export function validateGateBReview(
  action: GateBReviewAction,
  currentStatus: ArtifactStatus,
): GateBReviewError | null {
  if (!GATE_B_ALLOWED_ACTIONS.includes(action.type)) {
    return {
      code: "action_not_allowed",
      message: `Action "${action.type}" is not surfaced at Gate B.`,
    }
  }

  if (currentStatus !== REVIEWABLE_ARTIFACT_STATUS) {
    return {
      code: "not_awaiting_review",
      message: `Artifact is "${currentStatus}", not awaiting review; cannot ${action.type}.`,
    }
  }

  if (action.type === "feedback" && action.message.trim().length === 0) {
    return {
      code: "feedback_message_required",
      message: "Request changes requires a message describing what to revise.",
    }
  }

  if (action.type === "inline_edit" && action.content.trim().length === 0) {
    return {
      code: "empty_content",
      message: "Inline edit requires non-empty content.",
    }
  }

  return null
}

/**
 * The ArtifactStatus the artifact transitions to after a valid Gate B action.
 * - approve / inline_edit → approved (inline_edit is implicit approval; the edited
 *   body is the accepted final, mutated in place).
 * - feedback              → draft    (back to the producer queue for CLI re-produce;
 *   the reviewer note is persisted on the artifact).
 * - reject                → rejected (this artifact is killed; note persisted).
 */
export function resolveGateBTransition(action: GateBReviewAction): ArtifactStatus {
  switch (action.type) {
    case "approve":
    case "inline_edit":
      return "approved"
    case "feedback":
      return "draft"
    case "reject":
      return "rejected"
  }
}

/**
 * The reviewer note to persist for this action (null when the action carries no
 * note — a plain approve, or an inline_edit without a comment). Approve clears any
 * prior note; feedback/reject/edit-with-note set it. Mirrors Gate A.
 */
export function resolveArtifactReviewFeedback(action: GateBReviewAction): string | null {
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
