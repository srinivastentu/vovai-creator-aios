"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Sticky form footer: shows dirty/saved/error state on the left, actions on the
// right. Save errors render here inline (never a toast).
export function SaveBar({
  dirty,
  saving,
  error,
  onSave,
  onCancel,
  saveLabel = "Save",
  className,
}: {
  dirty: boolean
  saving: boolean
  error?: string | null
  onSave: () => void
  onCancel?: () => void
  saveLabel?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur",
        className,
      )}
    >
      <div className="min-h-5 text-sm">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : dirty ? (
          <span className="text-muted-foreground">Unsaved changes</span>
        ) : (
          <span className="text-muted-foreground">All changes saved</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button
          onClick={onSave}
          disabled={saving || !dirty}
          className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50"
        >
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  )
}
