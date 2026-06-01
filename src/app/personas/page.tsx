import Link from "next/link"
import { UserPlus } from "lucide-react"
import { listPersonas } from "@/lib/domain/data/personas"
import { personaToFormValues } from "@/lib/domain/persona-schema"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { PersonaCard } from "@/components/personas/PersonaCard"
import { AppFrame } from "@/components/shell/AppFrame"
import { PersonaPreview } from "@/components/shell/previews/PersonaPreview"

export const dynamic = "force-dynamic"

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>
}) {
  const [personas, { persona: selectedId }] = await Promise.all([
    listPersonas(),
    searchParams,
  ])
  const selected = selectedId ? personas.find((p) => p.id === selectedId) : undefined

  const left = (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Personas</h1>
          <p className="text-sm text-muted-foreground">
            Authoring identities for your content.
          </p>
        </div>
        <Button
          render={<Link href="/personas/new" />}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          Create Persona
        </Button>
      </header>

      {personas.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Create your first persona"
          description="A persona is the voice, audience, and point of view your content is written in."
          action={{ label: "Create Persona", href: "/personas/new" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p} selected={p.id === selectedId} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[{ label: "Personas" }]}
      left={left}
      preview={selected ? <PersonaPreview persona={personaToFormValues(selected)} /> : undefined}
      previewTitle="Persona"
      previewEmpty={{
        title: "Select a persona",
        description: "Choose a persona to preview its voice and audience.",
      }}
    />
  )
}
