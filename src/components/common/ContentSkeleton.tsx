import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Region loading placeholder (CR-13 §3). A small stack of skeleton bars for use
// inside a panel while its data loads. Wraps the generic ui/Skeleton.
export function ContentSkeleton({
  lines = 4,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  )
}
