"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { diffLines, diffStats } from "@/lib/diff"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface DiffVersion {
  id: string
  label: string
  body: string
}

// Line diff between any two artifact versions (branches). Two pickers choose the
// base (old) and compare (new); the unified diff highlights additions / removals.
export function DiffView({ versions }: { versions: DiffVersion[] }) {
  const [baseId, setBaseId] = useState(versions[0]?.id ?? "")
  const [compareId, setCompareId] = useState(
    (versions.length > 1 ? versions[versions.length - 1] : versions[0])?.id ?? "",
  )

  const base = versions.find((v) => v.id === baseId) ?? versions[0]
  const compare = versions.find((v) => v.id === compareId) ?? versions[0]

  const ops = useMemo(
    () => (base && compare ? diffLines(base.body, compare.body) : []),
    [base, compare],
  )
  const stats = useMemo(() => diffStats(ops), [ops])

  if (versions.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Only one version exists. Regenerate to create a second branch, then diff them here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Base</span>
        <Select value={baseId} onValueChange={(v) => v && setBaseId(v)}>
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">→ Compare</span>
        <Select value={compareId} onValueChange={(v) => v && setCompareId(v)}>
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="text-green-600">+{stats.added}</span>{" "}
          <span className="text-red-600">−{stats.removed}</span>
        </span>
      </div>

      {baseId === compareId ? (
        <p className="text-sm text-muted-foreground">Pick two different versions to compare.</p>
      ) : (
        <pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5">
          {ops.map((op, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap",
                op.type === "add" && "bg-green-500/10 text-green-800 dark:text-green-300",
                op.type === "remove" && "bg-red-500/10 text-red-800 dark:text-red-300",
                op.type === "equal" && "text-foreground/60",
              )}
            >
              <span className="select-none text-muted-foreground">
                {op.type === "add" ? "+ " : op.type === "remove" ? "− " : "  "}
              </span>
              {op.value || " "}
            </div>
          ))}
        </pre>
      )}
    </div>
  )
}
