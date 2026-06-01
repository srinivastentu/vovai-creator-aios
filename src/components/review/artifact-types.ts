import type { ArtifactStatus, ArtifactType, DerivedVia, IdeaStatus } from "@/generated/prisma/client"

// Serialization-safe view models for the Gate B client components. The server page
// maps Prisma rows (artifact + StageSession iteration records + sibling branches)
// into these — parsing the detailJson/gradeJson Json columns, dropping Date fields
// the UI doesn't render — before handing them to the client shell.

export interface ReviewIterationProducer {
  agentId: string
  snippet: string
  size: number
}

export interface ReviewIterationCritique {
  criticId: string
  snippet: string
}

export interface ReviewIterationDim {
  name: string
  score: number
}

/** One cross-critique iteration for the history panel. */
export interface ReviewIteration {
  version: number
  score: number | null
  dimensions: ReviewIterationDim[]
  producers: ReviewIterationProducer[]
  critiques: ReviewIterationCritique[]
  integratorSnippet: string | null
  judgeSkipped: boolean
  /** < producers.length signals the dialectic degraded to fewer voices (rule 9). */
  producersSucceeded: number
  costUSD: number
}

/** A sibling artifact of the SAME type — a branch in the fork lineage (flip + diff). */
export interface ReviewBranch {
  id: string
  derivedVia: DerivedVia
  status: ArtifactStatus
  bestScore: number | null
  /** The editable body (LinkedIn text / article markdown) — the diff source. */
  body: string
  createdAt: string
  /** True for the branch currently open. */
  isCurrent: boolean
}

export interface ReviewArtifact {
  id: string
  workspaceId: string
  workspaceName: string
  masterTitle: string
  ideaTitle: string
  ideaStatus: IdeaStatus
  artifactType: ArtifactType
  status: ArtifactStatus
  derivedVia: DerivedVia
  bestScore: number | null
  costUSD: number
  reviewFeedback: string | null
  /** The current artifact's editable body. */
  body: string
  iterationCount: number
  terminationReason: string | null
  iterations: ReviewIteration[]
  /** All branches of the same artifact type (incl. this one), oldest first. */
  branches: ReviewBranch[]
}
