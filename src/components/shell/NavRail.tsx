"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildNavItems, isNavItemActive } from "./nav"

// Far-left collapsible icon rail (52px ↔ 208px). Auto-collapses on review
// screens (AppFrame passes defaultCollapsed). Deferred items (Pipeline, Audit)
// render disabled with a hint.
export function NavRail({
  workspaceId,
  defaultCollapsed = false,
}: {
  workspaceId?: string
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const pathname = usePathname() ?? "/"
  const items = buildNavItems(workspaceId)

  return (
    <nav
      aria-label="Primary"
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-sidebar py-3 transition-[width] duration-150",
        collapsed ? "w-[52px]" : "w-52",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-pressed={collapsed}
        className="mx-2 mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeft className="size-4" />
      </button>

      <ul className="flex flex-1 flex-col gap-0.5 px-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = isNavItemActive(pathname, item)
          const base = cn(
            "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
            collapsed && "justify-center px-0",
          )
          if (item.disabled) {
            return (
              <li key={item.key}>
                <span
                  title={item.disabledHint}
                  aria-disabled
                  className={cn(base, "cursor-not-allowed text-muted-foreground/45")}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
              </li>
            )
          }
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
