"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import type { CreatorPersona } from "@/generated/prisma/client"
import { deletePersona } from "@/lib/domain/data/personas"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"

export function PersonaCard({ persona }: { persona: CreatorPersona }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bio = (persona.creatorProfile as { bio?: string } | null)?.bio ?? ""

  async function handleDelete() {
    setError(null)
    try {
      await deletePersona(persona.id)
      setConfirmOpen(false)
      toast.success("Persona deleted")
    } catch {
      setError("This persona still has workspaces and can't be deleted yet.")
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{persona.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {bio ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{bio}</p>
        ) : null}
        {persona.niches.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {persona.niches.map((n) => (
              <span
                key={n}
                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {n}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" size="sm" render={<Link href={`/personas/${persona.id}`} />}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setError(null)
            setConfirmOpen(true)
          }}
          aria-label={`Delete ${persona.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardFooter>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${persona.name}"?`}
        description="This permanently removes the persona. This can't be undone."
        confirmLabel="Delete persona"
        error={error}
        onConfirm={handleDelete}
      />
    </Card>
  )
}
