import { notFound } from "next/navigation"
import { getMasterForReview } from "@/lib/domain/data/masters"
import { GateAReview } from "@/components/review/GateAReview"
import type { ReviewMaster } from "@/components/review/types"

export const dynamic = "force-dynamic"

// Gate A — the non-negotiable source-traceability review for a Long-Form Master.
export default async function GateAReviewPage({
  params,
}: {
  params: Promise<{ id: string; masterId: string }>
}) {
  const { id, masterId } = await params
  const master = await getMasterForReview(masterId)
  // Not found, not owned (data layer user-scopes), or wrong workspace in the URL.
  if (!master || master.workspaceId !== id) notFound()

  const vm: ReviewMaster = {
    id: master.id,
    workspaceId: master.workspaceId,
    workspaceName: master.workspace.name,
    title: master.title,
    status: master.status,
    reviewFeedback: master.reviewFeedback,
    ideaTitle: master.idea.title,
    sections: master.sections.map((s) => ({
      id: s.id,
      order: s.order,
      heading: s.heading,
      contentMarkdown: s.contentMarkdown,
      sources: s.sourceRefs.map((r) => ({
        refId: r.id,
        relevanceSnippet: r.relevanceSnippet,
        sourceId: r.researchSource.id,
        url: r.researchSource.url,
        title: r.researchSource.title,
        type: r.researchSource.type,
        snippet: r.researchSource.snippet,
      })),
    })),
  }

  return <GateAReview master={vm} />
}
