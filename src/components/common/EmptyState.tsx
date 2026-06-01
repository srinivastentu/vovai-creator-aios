import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

// Shared (no directive): renders on the server for list pages (href action)
// and inside the client IdeaLog (onClick action). Each usage stays within one
// tree, so the LucideIcon prop never crosses a server→client boundary.
const PRIMARY_BTN =
  "inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium " +
  "bg-blue-600 text-white transition-colors hover:bg-blue-700 outline-none " +
  "focus-visible:ring-3 focus-visible:ring-ring/50"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href} className={PRIMARY_BTN}>
              {action.label}
            </Link>
          ) : (
            <Button
              onClick={action.onClick}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
