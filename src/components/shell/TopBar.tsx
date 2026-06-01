import { Fragment } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Breadcrumb } from "./types"

// Workbench top bar (row 1): optional workspace switcher, breadcrumb trail, and
// an optional status pill. Presentational — interactive children (a switcher)
// are passed in as nodes.
export function TopBar({
  breadcrumbs,
  workspaceSwitcher,
  statusPill,
  className,
}: {
  breadcrumbs: Breadcrumb[]
  workspaceSwitcher?: ReactNode
  statusPill?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4",
        className,
      )}
    >
      {workspaceSwitcher ? (
        <>
          {workspaceSwitcher}
          <span aria-hidden className="h-4 w-px bg-border" />
        </>
      ) : null}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && (
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
                )}
                <li className="min-w-0">
                  {crumb.href && !last ? (
                    <Link
                      href={crumb.href}
                      className="truncate text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={last ? "page" : undefined}
                      className={cn("truncate", last ? "font-medium text-foreground" : "text-muted-foreground")}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ol>
      </nav>

      {statusPill ? <div className="shrink-0">{statusPill}</div> : null}
    </header>
  )
}
