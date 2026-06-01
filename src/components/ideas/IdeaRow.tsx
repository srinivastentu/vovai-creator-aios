"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal } from "lucide-react"
import type { Idea } from "@/generated/prisma/client"
import { updateIdea, deleteIdea, type IdeaStatus } from "@/lib/domain/data/ideas"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/common/StatusBadge"
import { NicheTagInput } from "@/components/common/NicheTagInput"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { cn } from "@/lib/utils"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_ITEMS: { value: IdeaStatus; label: string }[] = [
  { value: "captured", label: "Captured" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
]

export function IdeaRow({
  idea,
  selected = false,
  onSelect,
}: {
  idea: Idea
  selected?: boolean
  onSelect?: () => void
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Edit-dialog form state
  const [title, setTitle] = useState(idea.title)
  const [description, setDescription] = useState(idea.description)
  const [niches, setNiches] = useState<string[]>(idea.niches)
  const [status, setStatus] = useState<IdeaStatus>(idea.status)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function openEdit() {
    setTitle(idea.title)
    setDescription(idea.description)
    setNiches(idea.niches)
    setStatus(idea.status)
    setEditError(null)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!title.trim()) return
    setSavingEdit(true)
    setEditError(null)
    try {
      await updateIdea(idea.id, { title: title.trim(), description, niches, status })
      setEditOpen(false)
      router.refresh()
    } catch {
      setEditError("Could not save changes. Try again.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function archive() {
    try {
      await updateIdea(idea.id, { status: "archived" })
      router.refresh()
    } catch {
      // CR-9 follow-up: surface the failure inline instead of swallowing it.
      toast.error("Could not archive this idea. Try again.")
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteIdea(idea.id)
      setConfirmOpen(false)
      router.refresh()
    } catch {
      setDeleteError("This idea already has a draft and can't be deleted yet.")
    }
  }

  return (
    <div
      className={cn(
        "relative flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors",
        selected && "ring-2 ring-blue-600",
      )}
    >
      {/* Selection overlay: a transparent, absolute button that captures clicks
          on the card body to select this idea for the preview pane. It is a
          SIBLING of the content — never an ancestor of the <h3> — so the heading
          keeps its role in the accessibility tree (a heading nested in a <button>
          is stripped to presentational). The action controls sit above it at z-10. */}
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Preview ${idea.title}`}
          aria-pressed={selected}
          className="absolute inset-0 cursor-pointer rounded-lg"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium">{idea.title}</h3>
          <StatusBadge status={idea.status} />
        </div>
        {idea.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{idea.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {idea.niches.map((n) => (
            <span key={n} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
              {n}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">
            captured {formatRelativeTime(idea.createdAt)}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1.5">
        {idea.status === "captured" ? (
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Available after the pipeline ships"
          >
            Promote
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Idea actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openEdit}>Edit</DropdownMenuItem>
            {idea.status !== "archived" ? (
              <DropdownMenuItem onClick={archive}>Archive</DropdownMenuItem>
            ) : null}
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
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-title-${idea.id}`}>Title</Label>
              <Input
                id={`edit-title-${idea.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-desc-${idea.id}`}>Description</Label>
              <Textarea
                id={`edit-desc-${idea.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as IdeaStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Niches</Label>
              <NicheTagInput value={niches} onChange={setNiches} />
            </div>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={savingEdit}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={saveEdit}
              disabled={savingEdit || !title.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${idea.title}"?`}
        description="This permanently removes the idea. This can't be undone."
        confirmLabel="Delete idea"
        error={deleteError}
        onConfirm={handleDelete}
      />
    </div>
  )
}
