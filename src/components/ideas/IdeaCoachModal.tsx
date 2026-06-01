"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createIdea } from "@/lib/domain/data/ideas"
import type { IdeaProposal } from "@/lib/domain/agents/idea-coach"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IdeaProposalCard } from "@/components/ideas/IdeaProposalCard"

export function IdeaCoachModal({
  open,
  onOpenChange,
  workspaceId,
  defaultNiche,
  niches,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  defaultNiche?: string
  niches: string[]
}) {
  const router = useRouter()
  const [umbrella, setUmbrella] = useState("")
  const [niche, setNiche] = useState(defaultNiche ?? niches[0] ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<IdeaProposal[] | null>(null)
  const [touched, setTouched] = useState(false)

  const invalid = umbrella.trim().length < 3 || niche.trim().length === 0

  async function propose() {
    if (invalid) {
      setTouched(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/ideas/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umbrella: umbrella.trim(), niche: niche.trim() }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { proposals: IdeaProposal[] }
      setProposals(data.proposals)
    } catch {
      setError("Idea Coach couldn't generate proposals. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function addToLog(p: IdeaProposal) {
    await createIdea({
      workspaceId,
      title: p.title,
      description: p.angle,
      niches: niche ? [niche] : [],
      status: "captured",
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) router.refresh() // reflect any added rows in the log behind
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Idea Coach</DialogTitle>
          <DialogDescription>
            Propose specific, publishable titles under an umbrella topic.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="coach-umbrella">Umbrella topic</Label>
            <Input
              id="coach-umbrella"
              value={umbrella}
              onChange={(e) => setUmbrella(e.target.value)}
              placeholder="e.g. Agentic AI development"
            />
          </div>
          <div className="space-y-1.5 sm:w-48">
            <Label>Niche</Label>
            {niches.length > 0 ? (
              <Select value={niche} onValueChange={(v) => setNiche(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a niche" />
                </SelectTrigger>
                <SelectContent>
                  {niches.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. AI engineering"
              />
            )}
          </div>
          <Button
            onClick={propose}
            disabled={loading}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {loading ? "Proposing…" : "Propose titles"}
          </Button>
        </div>
        {touched && invalid ? (
          <p className="text-sm text-destructive">
            Enter an umbrella topic (3+ characters) and a niche.
          </p>
        ) : null}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
          ) : error ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {error}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={propose}>
                  Retry
                </Button>
              </div>
            </div>
          ) : proposals ? (
            proposals.map((p, i) => (
              <IdeaProposalCard
                key={`${p.title}-${i}`}
                proposal={p}
                onAdd={() => addToLog(p)}
                onDiscard={() =>
                  setProposals((cur) => (cur ? cur.filter((_, idx) => idx !== i) : cur))
                }
              />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Enter a topic and niche, then propose titles.
            </p>
          )}
        </div>

        <DialogFooter>
          {proposals ? (
            <Button variant="outline" onClick={propose} disabled={loading}>
              Propose more
            </Button>
          ) : null}
          <DialogClose render={<Button variant="ghost">Done</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
