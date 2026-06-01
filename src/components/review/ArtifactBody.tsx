import type { ArtifactType } from "@/generated/prisma/client"
import { MarkdownView } from "./MarkdownView"

// Render an artifact body for its type: a LinkedIn post is plain text with
// meaningful line breaks (preformatted); a long-form article is markdown.
export function ArtifactBody({ type, body }: { type: ArtifactType; body: string }) {
  if (type === "linkedin_post") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{body}</p>
    )
  }
  return <MarkdownView>{body}</MarkdownView>
}

/** Body size label for the artifact type (chars for LinkedIn, words for article). */
export function bodySizeLabel(type: ArtifactType, body: string): string {
  if (type === "linkedin_post") return `${body.trim().length} chars`
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return `${words} words`
}
