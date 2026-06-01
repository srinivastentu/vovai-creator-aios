"use client"

import { useState } from "react"
import { Check, MessageSquare, RefreshCw, X } from "lucide-react"
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

// V1 surfaces 4 of the engine's 6 review actions at Gate B.
// TODO(V2): surface use_segments + mix_produce actions.
// The engine processes them; only the UI is gated.

interface GateBActionsProps {
  busy: boolean
  regenerating: boolean
  /** True when the editor body differs from the saved artifact (Approve saves the edit). */
  dirty: boolean
  onApprove: () => void
  onRequestChanges: (message: string) => void
  onReject: (reason: string) => void
  onRegenerate: () => void
}

export function GateBActions({
  busy,
  regenerating,
  dirty,
  onApprove,
  onRequestChanges,
  onReject,
  onRegenerate,
}: GateBActionsProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState("")
  const [rejectReason, setRejectReason] = useState("")

  const disabled = busy || regenerating

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      {dirty ? (
        <span className="mr-auto text-xs text-muted-foreground">
          Edited — “Approve” saves your edits and approves; “Regenerate” forks a new
          cross-critique run from your edits.
        </span>
      ) : null}

      <Button variant="outline" onClick={() => setRegenOpen(true)} disabled={disabled}>
        <RefreshCw className={regenerating ? "size-4 animate-spin" : "size-4"} />
        {regenerating ? "Regenerating…" : "Regenerate"}
      </Button>

      <Button variant="outline" onClick={() => setFeedbackOpen(true)} disabled={disabled}>
        <MessageSquare className="size-4" />
        Request changes
      </Button>

      <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={disabled}>
        <X className="size-4" />
        Reject
      </Button>

      <Button
        onClick={onApprove}
        disabled={disabled}
        className="bg-green-600 text-white hover:bg-green-700"
      >
        <Check className="size-4" />
        {busy ? "Working…" : dirty ? "Save & approve" : "Approve"}
      </Button>

      {/* Request changes (feedback) — message required */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Describe what to revise. The artifact returns to draft for a
              re-produce; your note is saved with it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gate-b-feedback">Feedback</Label>
            <Textarea
              id="gate-b-feedback"
              rows={4}
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              placeholder="e.g. The hook is buried — lead with the contrarian claim."
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
            <DialogTitle>Reject this artifact?</DialogTitle>
            <DialogDescription>
              The artifact is marked rejected. Earlier versions and the iteration
              history are preserved (immutable history); only the status changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gate-b-reject">Reason (optional)</Label>
            <Textarea
              id="gate-b-reject"
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

      {/* Regenerate — confirm (it runs a live, billed cross-critique loop) */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate from your edits?</DialogTitle>
            <DialogDescription>
              This forks a new branch: your current editor content is saved as an
              edit, then a fresh cross-critique loop (two producers, two critics, an
              integrator, and a judge) regenerates from it. Runs live — roughly 1–2
              minutes and about $0.30–$0.45. The original artifact is untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={regenerating}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={() => {
                onRegenerate()
                setRegenOpen(false)
              }}
              disabled={regenerating}
            >
              <RefreshCw className="size-4" />
              Run cross-critique
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
