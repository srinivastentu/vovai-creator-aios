"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Link2, Plus } from "lucide-react"
import { createIdea } from "@/lib/domain/data/ideas"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { NicheTagInput } from "@/components/common/NicheTagInput"
import { cn } from "@/lib/utils"

// Pinned quick-add row. Title is required; the ▾ expander reveals description,
// niches, and a source URL. Add failure is shown inline with the text kept.
export function IdeaQuickAddRow({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [niches, setNiches] = useState<string[]>([])
  const [sourceUrl, setSourceUrl] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createIdea({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        niches,
        sourceUrl: sourceUrl.trim() || undefined,
      })
      setTitle("")
      setDescription("")
      setNiches([])
      setSourceUrl("")
      setExpanded(false)
      router.refresh()
      titleRef.current?.focus()
    } catch {
      setError("Could not add the idea. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void add()
            }
          }}
          placeholder="Capture an idea…"
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add details"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </Button>
        <Button
          onClick={add}
          disabled={saving || !title.trim()}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent className="space-y-2 pt-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <NicheTagInput
              value={niches}
              onChange={setNiches}
              className="flex-1"
              placeholder="Add a niche…"
            />
            <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 sm:w-64">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Source URL (optional)"
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
