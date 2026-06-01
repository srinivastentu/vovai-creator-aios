"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createWorkspace } from "@/lib/domain/data/workspaces"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NicheTagInput } from "@/components/common/NicheTagInput"

const WorkspaceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  personaId: z.string().min(1, "Choose a persona"),
  description: z.string(),
  niches: z.array(z.string()),
})
type WorkspaceFormValues = z.infer<typeof WorkspaceFormSchema>

export function WorkspaceForm({
  personas,
}: {
  personas: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(WorkspaceFormSchema),
    defaultValues: {
      name: "",
      personaId: personas[0]?.id ?? "",
      description: "",
      niches: [],
    },
  })

  async function onValid(values: WorkspaceFormValues) {
    setSaveError(null)
    try {
      const ws = await createWorkspace(values)
      router.push(`/workspaces/${ws.id}`)
      router.refresh()
    } catch {
      setSaveError("Could not create the workspace. Try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} placeholder="e.g. Agentic AI content" />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Persona</Label>
        <Controller
          control={control}
          name="personaId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a persona" />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.personaId ? (
          <p className="text-sm text-destructive">{errors.personaId.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          rows={2}
          placeholder="What this workspace is for…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Niches <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Controller
          control={control}
          name="niches"
          render={({ field }) => (
            <NicheTagInput value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isSubmitting ? "Creating…" : "Create workspace"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/workspaces")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
