"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Lightbulb } from "lucide-react"
import type { Idea } from "@/generated/prisma/client"
import type { IdeaStatus } from "@/lib/domain/data/ideas"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/common/EmptyState"
import { IdeaQuickAddRow } from "@/components/ideas/IdeaQuickAddRow"
import { IdeaRow } from "@/components/ideas/IdeaRow"
import { IdeaCoachModal } from "@/components/ideas/IdeaCoachModal"

export interface IdeaFilterValues {
  status?: IdeaStatus
  niche?: string
  q?: string
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "captured", label: "Captured" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
]

export function IdeaLogTable({
  workspaceId,
  ideas,
  nicheUnion,
  defaultNiche,
  filter,
}: {
  workspaceId: string
  ideas: Idea[]
  nicheUnion: string[]
  defaultNiche?: string
  filter: IdeaFilterValues
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(filter.q ?? "")
  const [coachOpen, setCoachOpen] = useState(false)

  // Re-sync the local search box if the URL changes from elsewhere.
  useEffect(() => {
    setQ(filter.q ?? "")
  }, [filter.q])

  function pushFilter(next: IdeaFilterValues) {
    const merged: IdeaFilterValues = {
      status: filter.status,
      niche: filter.niche,
      q: filter.q,
      ...next,
    }
    const params = new URLSearchParams()
    if (merged.status) params.set("status", merged.status)
    if (merged.niche) params.set("niche", merged.niche)
    if (merged.q) params.set("q", merged.q)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  // Debounce the search box → URL.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((filter.q ?? "") !== q) pushFilter({ q: q || undefined })
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const filtersActive = Boolean(filter.status || filter.niche || filter.q)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ideas…"
          className="w-48"
        />
        <Select
          value={filter.status ?? "all"}
          onValueChange={(v) =>
            pushFilter({ status: !v || v === "all" ? undefined : (v as IdeaStatus) })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {nicheUnion.length > 0 ? (
          <Select
            value={filter.niche ?? "all"}
            onValueChange={(v) => pushFilter({ niche: !v || v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All niches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All niches</SelectItem>
              {nicheUnion.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="ml-auto">
          <Button variant="outline" onClick={() => setCoachOpen(true)}>
            <Lightbulb className="size-4" />
            Idea Coach
          </Button>
        </div>
      </div>

      <IdeaQuickAddRow workspaceId={workspaceId} />

      {ideas.length === 0 ? (
        filtersActive ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <span>No ideas match these filters.</span>
            <Button variant="link" onClick={() => router.replace(pathname)}>
              Clear filters
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Lightbulb}
            title="No ideas yet"
            description="Capture one above, or let Idea Coach propose a few."
            action={{ label: "Open Idea Coach", onClick: () => setCoachOpen(true) }}
          />
        )
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} />
          ))}
        </div>
      )}

      <IdeaCoachModal
        open={coachOpen}
        onOpenChange={setCoachOpen}
        workspaceId={workspaceId}
        defaultNiche={defaultNiche}
        niches={nicheUnion}
      />
    </div>
  )
}
