import { notFound } from "next/navigation"
import type { ArtifactType } from "@/generated/prisma/client"
import { getArtifactForReview } from "@/lib/domain/data/artifacts"
import { GateBReview } from "@/components/review/GateBReview"
import type { ReviewArtifact, ReviewBranch, ReviewIteration } from "@/components/review/artifact-types"

export const dynamic = "force-dynamic"

// ─── Defensive JSON parsers (Artifact.content / IterationRecord.*Json are unknown) ──
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function num(v: unknown): number {
  return typeof v === "number" ? v : 0
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null
}

/** The editable body of an Artifact.content for its type (markdown / text). */
function bodyOf(type: ArtifactType, content: unknown): string {
  const c = obj(content)
  if (type === "long_form_article" && typeof c.markdown === "string") return c.markdown
  if (type === "linkedin_post" && typeof c.text === "string") return c.text
  return ""
}

function parseIteration(row: {
  version: number
  gradeJson: unknown
  detailJson: unknown
  costUSD: number
}): ReviewIteration {
  const grade = obj(row.gradeJson)
  const detail = obj(row.detailJson)
  return {
    version: row.version,
    score: numOrNull(grade.overallScore),
    dimensions: arr(grade.dimensionScores).map((d) => {
      const o = obj(d)
      return { name: str(o.name), score: num(o.score) }
    }),
    producers: arr(detail.producers).map((p) => {
      const o = obj(p)
      return { agentId: str(o.agentId), snippet: str(o.snippet), size: num(o.size) }
    }),
    critiques: arr(detail.critiques).map((c) => {
      const o = obj(c)
      return { criticId: str(o.criticId), snippet: str(o.snippet) }
    }),
    integratorSnippet:
      typeof detail.integratorSnippet === "string" ? detail.integratorSnippet : null,
    judgeSkipped: detail.judgeSkipped === true,
    producersSucceeded: num(detail.producersSucceeded),
    costUSD: row.costUSD,
  }
}

// Gate B — per-artifact review (inline editor + iteration history + fork-on-regenerate).
export default async function GateBReviewPage({
  params,
}: {
  params: Promise<{ id: string; artifactId: string }>
}) {
  const { id, artifactId } = await params
  const data = await getArtifactForReview(artifactId)
  // Not found, not owned (data layer user-scopes), or wrong workspace in the URL.
  if (!data || data.artifact.workspaceId !== id) notFound()

  const { artifact, stageSession, siblings } = data
  const type = artifact.artifactType
  const iterations = (stageSession?.iterationRecords ?? []).map(parseIteration)

  const branches: ReviewBranch[] = siblings
    .filter((s) => s.artifactType === type)
    .map((s) => ({
      id: s.id,
      derivedVia: s.derivedVia,
      status: s.status,
      bestScore: s.bestScore,
      body: bodyOf(type, s.content),
      createdAt: s.createdAt.toISOString(),
      isCurrent: s.id === artifact.id,
    }))

  const vm: ReviewArtifact = {
    id: artifact.id,
    workspaceId: artifact.workspaceId,
    workspaceName: artifact.workspace.name,
    masterTitle: artifact.longFormMaster.title,
    ideaTitle: artifact.longFormMaster.idea.title,
    ideaStatus: artifact.longFormMaster.idea.status,
    artifactType: type,
    status: artifact.status,
    derivedVia: artifact.derivedVia,
    bestScore: artifact.bestScore,
    costUSD: artifact.costUSD,
    reviewFeedback: artifact.reviewFeedback,
    body: bodyOf(type, artifact.content),
    iterationCount: iterations.length,
    terminationReason: stageSession?.terminationReason ?? null,
    iterations,
    branches,
  }

  return <GateBReview artifact={vm} />
}
