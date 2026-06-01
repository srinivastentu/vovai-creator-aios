import type { IdeaStatus } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"

// Locked status → color system: captured slate · in_progress blue ·
// completed green · archived muted. Soft-bg badges.
const STATUS_STYLES: Record<IdeaStatus, { label: string; className: string }> = {
  captured: {
    label: "Captured",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground",
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: IdeaStatus
  className?: string
}) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
