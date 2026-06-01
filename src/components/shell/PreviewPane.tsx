import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/common/EmptyState"

// Right column of the workbench. Renders whatever preview a route supplies
// ("as it will appear"), or a tasteful empty state when nothing is selected.
export function PreviewPane({
  title = "Preview",
  children,
  empty,
  className,
}: {
  title?: string
  children?: ReactNode
  empty?: { icon?: LucideIcon; title: string; description?: string }
  className?: string
}) {
  const hasContent = children != null && children !== false
  return (
    <section
      aria-label={title}
      className={cn("flex h-full min-w-0 flex-col bg-muted/30", className)}
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border px-4">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {hasContent ? (
          children
        ) : (
          <EmptyState
            icon={empty?.icon ?? Eye}
            title={empty?.title ?? "Nothing to preview"}
            description={empty?.description ?? "Select an item to see it rendered here."}
            className="h-full border-none bg-transparent"
          />
        )}
      </div>
    </section>
  )
}
