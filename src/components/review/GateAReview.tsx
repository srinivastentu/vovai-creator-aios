"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import type { MasterStatus } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { submitGateAReview } from "@/lib/domain/data/masters"
import type { GateAReviewAction } from "@/lib/domain/workflows/creator/review/master-review"
import { MarkdownView } from "./MarkdownView"
import { MasterStatusBadge } from "./MasterStatusBadge"
import { SourcePanel } from "./SourcePanel"
import { GateAActions } from "./GateAActions"
import type { ReviewMaster } from "./types"

interface Draft {
  id: string
  heading: string
  contentMarkdown: string
}

// Partial<Record<MasterStatus, ...>> (not Record<string, ...>) keeps the
// coding-standard exhaustiveness: a new MasterStatus surfaces here at compile
// time rather than silently falling through to the raw enum string.
const NON_PENDING_LABEL: Partial<Record<MasterStatus, string>> = {
  draft: "back in draft",
  approved: "approved",
  in_repurpose: "in repurpose",
}

// Gate A review shell: left section list · center section (markdown / inline
// edit) · right source-traceability panel · sticky action bar. All review state
// (selection, edit drafts, busy) lives here; the children are presentational.
export function GateAReview({ master }: { master: ReviewMaster }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(master.sections[0]?.id ?? "")
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busy, setBusy] = useState(false)

  const pending = master.status === "gate_a_pending"
  const selected = master.sections.find((s) => s.id === selectedId) ?? master.sections[0]

  function startEdit() {
    const seed: Record<string, Draft> = {}
    for (const s of master.sections) {
      seed[s.id] = { id: s.id, heading: s.heading, contentMarkdown: s.contentMarkdown }
    }
    setDrafts(seed)
    setEditing(true)
  }

  function cancelEdit() {
    setDrafts({})
    setEditing(false)
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  }

  async function run(action: GateAReviewAction, successMsg: string) {
    setBusy(true)
    try {
      await submitGateAReview(master.id, action)
      toast.success(successMsg)
      router.push(`/workspaces/${master.workspaceId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.")
      setBusy(false)
    }
  }

  const handleApprove = () => run({ type: "approve" }, "Master approved.")
  const handleRequestChanges = (message: string) =>
    run({ type: "feedback", message }, "Changes requested — master returned to draft.")
  const handleReject = (reason: string) =>
    run(
      { type: "reject", message: reason || undefined },
      "Master rejected — returned to draft.",
    )
  const handleSaveEdit = () =>
    run({ type: "inline_edit", sections: Object.values(drafts) }, "Edits saved — master approved.")

  const draft = selected ? drafts[selected.id] : undefined

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 pb-24">
      <Link
        href={`/workspaces/${master.workspaceId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {master.workspaceName}
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold">{master.title}</h1>
          <MasterStatusBadge status={master.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Gate A · source traceability review · idea: {master.ideaTitle}
        </p>
      </div>

      {!pending ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">
            This master is {NON_PENDING_LABEL[master.status] ?? master.status}. Gate A
            actions are unavailable.
          </p>
          {master.reviewFeedback ? (
            <p className="mt-1 text-muted-foreground">
              Reviewer note: “{master.reviewFeedback}”
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left: section list */}
        <nav className="h-fit rounded-lg border border-border p-2">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Sections ({master.sections.length})
          </p>
          {master.sections.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">No sections.</p>
          ) : (
            <ul className="space-y-0.5">
              {master.sections.map((s) => {
                const active = s.id === selected?.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left",
                        active ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn("block truncate text-sm", active && "font-medium")}
                      >
                        {s.order}. {s.heading}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          s.sources.length === 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.sources.length} source{s.sources.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        {/* Center: selected section (read or edit) */}
        <section className="min-w-0 rounded-lg border border-border p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">This master has no sections to review.</p>
          ) : editing && draft ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-heading">Heading</Label>
                <Input
                  id="edit-heading"
                  value={draft.heading}
                  onChange={(e) => updateDraft(selected.id, { heading: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-body">Content (markdown)</Label>
                <Textarea
                  id="edit-body"
                  rows={18}
                  className="font-mono text-xs"
                  value={draft.contentMarkdown}
                  onChange={(e) =>
                    updateDraft(selected.id, { contentMarkdown: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Switch sections in the left rail to edit others; all edits save together.
              </p>
            </div>
          ) : (
            <article>
              <h2 className="font-heading text-lg font-semibold">{selected.heading}</h2>
              <div className="mt-3">
                <MarkdownView>{selected.contentMarkdown}</MarkdownView>
              </div>
            </article>
          )}
        </section>

        {/* Right: sources for the selected section */}
        {selected ? (
          <SourcePanel heading={selected.heading} sources={selected.sources} />
        ) : (
          <div />
        )}
      </div>

      {pending ? (
        <GateAActions
          busy={busy}
          editing={editing}
          onApprove={handleApprove}
          onRequestChanges={handleRequestChanges}
          onReject={handleReject}
          onStartEdit={startEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={cancelEdit}
        />
      ) : null}
    </main>
  )
}
