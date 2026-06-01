import type { IdeaStatus } from "@/generated/prisma/client"
import { ExternalLink } from "lucide-react"
import { StatusBadge } from "@/components/common/StatusBadge"

// Right-pane detail of the selected idea. Read-only render of the Idea row.
export function IdeaPreview({
  idea,
}: {
  idea: {
    title: string
    description?: string | null
    niches: string[]
    status: IdeaStatus
    sourceUrl?: string | null
  }
}) {
  return (
    <div className="mx-auto max-w-prose space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{idea.title}</h2>
        <StatusBadge status={idea.status} />
      </div>

      {idea.niches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {idea.niches.map((n, i) => (
            <span key={`${n}-${i}`} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {n}
            </span>
          ))}
        </div>
      )}

      {idea.description ? (
        <p className="text-sm leading-7 text-foreground/90 whitespace-pre-wrap">{idea.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground/70">No description.</p>
      )}

      {idea.sourceUrl ? (
        <a
          href={idea.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ExternalLink className="size-3.5" />
          <span className="truncate">{idea.sourceUrl}</span>
        </a>
      ) : null}
    </div>
  )
}
