"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { updateWorkspace, deleteWorkspace } from "@/lib/domain/data/workspaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"

// Shared rename + delete menu used by both the workspace list rows and the
// dashboard header. `redirectOnDelete` sends the dashboard back to the list.
export function WorkspaceActionsMenu({
  workspace,
  redirectOnDelete = false,
}: {
  workspace: { id: string; name: string }
  redirectOnDelete?: boolean
}) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [name, setName] = useState(workspace.name)
  const [savingName, setSavingName] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleRename() {
    const next = name.trim()
    if (!next) return
    setSavingName(true)
    try {
      await updateWorkspace(workspace.id, { name: next })
      setRenameOpen(false)
      router.refresh()
    } finally {
      setSavingName(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteWorkspace(workspace.id)
      setConfirmOpen(false)
      if (redirectOnDelete) router.push("/workspaces")
      else router.refresh()
    } catch {
      setDeleteError("This workspace still has ideas or drafts and can't be deleted yet.")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Workspace actions">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setName(workspace.name)
              setRenameOpen(true)
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteError(null)
              setConfirmOpen(true)
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ws-rename">Name</Label>
            <Input
              id="ws-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={savingName}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={handleRename}
              disabled={savingName || !name.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {savingName ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${workspace.name}"?`}
        description="This permanently removes the workspace. This can't be undone."
        confirmLabel="Delete workspace"
        error={deleteError}
        onConfirm={handleDelete}
      />
    </>
  )
}
