"use client"

import { useState } from "react"
import { Check, MessageSquare, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// V1 surfaces 4 of the engine's 6 review actions at Gate A.
// TODO(V2): surface use_segments + mix_produce actions.
// The engine processes them; only the UI is gated.

interface GateAActionsProps {
  busy: boolean
  editing: boolean
  onApprove: () => void
  onRequestChanges: (message: string) => void
  onReject: (reason: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}

export function GateAActions({
  busy,
  editing,
  onApprove,
  onRequestChanges,
  onReject,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: GateAActionsProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState("")
  const [rejectReason, setRejectReason] = useState("")

  if (editing) {
    return (
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          Editing sections — saving accepts your edits and approves the master.
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancelEdit} disabled={busy}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button
            onClick={onSaveEdit}
            disabled={busy}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Check className="size-4" />
            {busy ? "Saving…" : "Save & approve"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <Button variant="outline" onClick={onStartEdit} disabled={busy}>
        <Pencil className="size-4" />
        Inline edit
      </Button>

      <Button variant="outline" onClick={() => setFeedbackOpen(true)} disabled={busy}>
        <MessageSquare className="size-4" />
        Request changes
      </Button>

      <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
        <X className="size-4" />
        Reject
      </Button>

      <Button
        onClick={onApprove}
        disabled={busy}
        className="bg-green-600 text-white hover:bg-green-700"
      >
        <Check className="size-4" />
        {busy ? "Working…" : "Approve"}
      </Button>

      {/* Request changes (feedback) — message required */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Describe what to revise. The master returns to draft for
              re-synthesis; your note is saved with it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gate-a-feedback">Feedback</Label>
            <Textarea
              id="gate-a-feedback"
              rows={4}
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              placeholder="e.g. Section 2 overstates the claim — soften and cite the primary source."
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={busy}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={() => {
                onRequestChanges(feedbackMsg.trim())
                setFeedbackOpen(false)
              }}
              disabled={busy || feedbackMsg.trim().length === 0}
            >
              Send & return to draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject — optional reason */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this master?</DialogTitle>
            <DialogDescription>
              The master returns to draft for a fresh synthesis. Sections and
              sources are preserved (immutable history); only the status changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gate-a-reject">Reason (optional)</Label>
            <Textarea
              id="gate-a-reject"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this being rejected?"
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={busy}>
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={() => {
                onReject(rejectReason.trim())
                setRejectOpen(false)
              }}
              disabled={busy}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
