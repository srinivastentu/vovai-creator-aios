import type { ArtifactStatus } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"

// ArtifactStatus → color system, parallel to MasterStatusBadge / common/StatusBadge.
// awaiting_review is the amber "act on me" state Gate B reviews.
const STATUS_STYLES: Record<ArtifactStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  awaiting_review: {
    label: "Awaiting review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
}

export function ArtifactStatusBadge({
  status,
  className,
}: {
  status: ArtifactStatus
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
