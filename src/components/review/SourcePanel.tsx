import { ExternalLink } from "lucide-react"
import type { ReviewSource } from "./types"

// Right pane of Gate A: the source-traceability panel (non-negotiable per
// pipeline-v1.md / review-system-v1.md). Shows every ResearchSource linked to
// the selected section, with the relevance snippet that informed it. A section
// with zero sources is surfaced as a traceability failure.
export function SourcePanel({
  heading,
  sources,
}: {
  heading: string
  sources: ReviewSource[]
}) {
  return (
    <aside className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium">Sources</h2>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
        {sources.length === 0
          ? "Traceability for the selected section."
          : `${sources.length} source${sources.length === 1 ? "" : "s"} informing this section.`}
      </p>

      {sources.length === 0 ? (
        <p className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          No sources linked to “{heading}”. This section fails Gate A&apos;s
          traceability requirement (every section must cite ≥1 source).
        </p>
      ) : (
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.refId} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm leading-tight font-medium">{s.title}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tracking-wide uppercase text-muted-foreground">
                  {s.type}
                </span>
              </div>
              {s.type === "web" ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{s.url}</span>
                </a>
              ) : (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {s.url}
                </span>
              )}
              <p className="mt-2 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                “{s.relevanceSnippet}”
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
