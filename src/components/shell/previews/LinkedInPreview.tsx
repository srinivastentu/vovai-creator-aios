import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

// Renders a LinkedIn post "as it will appear" — a feed-style card. Frontend
// presentation of the artifact body only; engagement counts are mocked chrome.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "C"
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function LinkedInPreview({
  body,
  authorName = "Creator",
  authorHeadline,
  className,
}: {
  body: string
  authorName?: string
  authorHeadline?: string
  className?: string
}) {
  return (
    <div className={cn("mx-auto max-w-[34rem]", className)}>
      <article className="rounded-lg border border-border bg-card shadow-sm">
        <header className="flex items-start gap-3 px-4 pt-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initials(authorName)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">
              {authorName} <span className="font-normal text-muted-foreground">• 1st</span>
            </p>
            {authorHeadline ? (
              <p className="truncate text-xs text-muted-foreground">{authorHeadline}</p>
            ) : null}
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              Now <span aria-hidden>·</span> <Globe className="size-3" />
            </p>
          </div>
        </header>

        <div className="px-4 py-3">
          <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">{body}</p>
        </div>

        <footer className="flex items-center justify-around border-t border-border px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {["Like", "Comment", "Repost", "Send"].map((a) => (
            <span key={a} className="rounded px-3 py-1.5">
              {a}
            </span>
          ))}
        </footer>
      </article>
    </div>
  )
}
