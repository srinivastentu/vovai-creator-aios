import type { MasterStatus, SourceType } from "@/generated/prisma/client"

// Serialization-safe view models for the Gate A client components. The server
// page maps the Prisma `MasterForReview` into these (flattening sourceRefs,
// dropping Date fields the UI doesn't render) before handing them to the client.

export interface ReviewSource {
  refId: string // SourceRef id (stable list key)
  relevanceSnippet: string
  sourceId: string
  url: string
  title: string
  type: SourceType
  snippet: string
}

export interface ReviewSection {
  id: string
  order: number
  heading: string
  contentMarkdown: string
  sources: ReviewSource[]
}

export interface ReviewMaster {
  id: string
  workspaceId: string
  workspaceName: string
  title: string
  status: MasterStatus
  reviewFeedback: string | null
  ideaTitle: string
  sections: ReviewSection[]
}
