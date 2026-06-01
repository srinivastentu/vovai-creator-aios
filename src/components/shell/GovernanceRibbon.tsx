import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GovernanceApproval, GovernanceRibbonData } from "./types"

// Row-2 governance ribbon on review screens. Surfaces the lineage/score/cost/
// approval CreatorOS already records (IterationRecord/StageSession/Artifact),
// shaped by ./governance.ts. Presentational only.

const APPROVAL_META: Record<GovernanceApproval, { label: string; className: string }> = {
  in_review: { label: "In review", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  changes_requested: {
    label: "Changes requested",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{children}</span>
    </div>
  )
}

export function GovernanceRibbon({ data }: { data: GovernanceRibbonData }) {
  const approval = APPROVAL_META[data.approval]
  const scorePass = data.score != null && data.threshold != null && data.score >= data.threshold

  return (
    <div className="flex h-9 shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-muted/40 px-4">
      <span className="font-mono text-xs text-foreground">{data.versionLabel}</span>

      {data.deterministic ? (
        <span className="text-xs text-muted-foreground">Deterministic synthesis</span>
      ) : (
        <>
          {data.modelLineage.length > 0 && (
            <Field label="Lineage">
              <span className="font-mono">{data.modelLineage.join(" → ")}</span>
            </Field>
          )}
          {data.score != null && (
            <Field label="Score">
              <span className={cn("font-mono", scorePass ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400")}>
                {data.score.toFixed(1)}
                {data.threshold != null && <span className="text-muted-foreground">/{data.threshold}</span>}
              </span>
            </Field>
          )}
          {data.iterations != null && (
            <Field label="Iterations">
              <span className="font-mono">{data.iterations}</span>
            </Field>
          )}
          <Field label="Cost">
            <span className="font-mono">${data.costUSD.toFixed(4)}</span>
          </Field>
        </>
      )}

      <span
        className={cn(
          "ml-auto inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
          approval.className,
        )}
      >
        {approval.label}
      </span>

      {data.auditHref && (
        <Link
          href={data.auditHref}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          Audit
          <ExternalLink className="size-3" />
        </Link>
      )}
    </div>
  )
}
