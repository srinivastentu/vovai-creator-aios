import type { LucideIcon } from "lucide-react"

// Shared types for the CR-13 Workbench shell (AppFrame + NavRail + TopBar +
// GovernanceRibbon + SplitPane + PreviewPane). Pure types only — no React,
// no domain imports. Domain → UI mapping (e.g. governanceFromArtifact) lives
// in ./governance.ts so it stays unit-testable without rendering.

/** A far-left NavRail entry. */
export interface NavItem {
  key: string
  href: string
  label: string
  icon: LucideIcon
  /** Disabled + "Coming in V1.1" hint. Pipeline + Audit routes are deferred. */
  disabled?: boolean
  /** Tooltip/title text when disabled. */
  disabledHint?: string
}

/** One crumb in the TopBar breadcrumb trail. The last crumb is the current page. */
export interface Breadcrumb {
  label: string
  href?: string
}

/** How the AppFrame lays out: standard pages vs. a review screen (ribbon + collapsed rail). */
export type FrameVariant = "standard" | "review"

/** Human-facing approval state shown in the governance ribbon. */
export type GovernanceApproval =
  | "in_review"
  | "approved"
  | "rejected"
  | "changes_requested"

/**
 * Data the GovernanceRibbon renders. Every field is derived from the
 * already-fetched Gate A/B view models (ReviewArtifact / ReviewMaster) — the
 * ribbon needs NO new backend read (see ./governance.ts).
 */
export interface GovernanceRibbonData {
  /** e.g. "v3 · LinkedIn post" — a stable, human-readable version label. */
  versionLabel: string
  /** Model lineage, producer→producer + judge, e.g. ["Claude", "GPT-4o", "Gemini judge"]. */
  modelLineage: string[]
  /** Best composite score (0–100), or null when not graded (deterministic synthesis). */
  score: number | null
  /** Pass threshold for the stage, or null. */
  threshold: number | null
  /** Cross-critique iteration count, or null when there were none. */
  iterations: number | null
  /** Total cost in USD for the run. */
  costUSD: number
  approval: GovernanceApproval
  /** Link to the audit view (deferred to V1.1 — omitted in V1). */
  auditHref?: string
  /**
   * Gate A masters are produced by a deterministic synthesizer (no judge, no
   * cross-critique). When true the ribbon hides score/iterations/lineage and
   * shows a "Deterministic synthesis" label instead.
   */
  deterministic: boolean
}
