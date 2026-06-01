import { MarkdownView } from "@/components/review/MarkdownView"
import { cn } from "@/lib/utils"

// Renders a long-form article "as it will appear" — a clean reading view at
// ~70ch. The body is markdown (rendered via the shared MarkdownView).
export function ArticlePreview({
  body,
  title,
  byline,
  className,
}: {
  body: string
  title?: string
  byline?: string
  className?: string
}) {
  return (
    <article className={cn("mx-auto max-w-[70ch]", className)}>
      {title ? (
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      ) : null}
      {byline ? <p className="mb-6 text-sm text-muted-foreground">{byline}</p> : <div className="mb-6" />}
      <div className="text-base leading-7">
        <MarkdownView>{body}</MarkdownView>
      </div>
    </article>
  )
}
