import type { MasterStatus } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"

// MasterStatus → color system, parallel to common/StatusBadge for IdeaStatus.
// gate_a_pending is the "awaiting review" amber state Gate A acts on.
const STATUS_STYLES: Record<MasterStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  gate_a_pending: {
    label: "Awaiting review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  in_repurpose: {
    label: "In repurpose",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
}

export function MasterStatusBadge({
  status,
  className,
}: {
  status: MasterStatus
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
