"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import type { IdeaProposal } from "@/lib/domain/agents/idea-coach"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Full compact card — rationale (angle) always visible, no hover-reveal.
export function IdeaProposalCard({
  proposal,
  onAdd,
  onDiscard,
}: {
  proposal: IdeaProposal
  onAdd: () => Promise<void> | void
  onDiscard: () => void
}) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle")

  async function handleAdd() {
    setState("adding")
    try {
      await onAdd()
      setState("added")
    } catch {
      setState("idle")
    }
  }

  if (state === "added") {
    return (
      <Card className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Check className="size-4 text-green-600" />
        Added “{proposal.title}”
      </Card>
    )
  }

  return (
    <Card className="space-y-2 p-3">
      <h4 className="text-sm font-medium leading-snug">{proposal.title}</h4>
      <p className="text-sm text-muted-foreground">{proposal.angle}</p>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={state === "adding"}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {state === "adding" ? "Adding…" : "Add to log"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          <X className="size-3.5" />
          Discard
        </Button>
      </div>
    </Card>
  )
}
