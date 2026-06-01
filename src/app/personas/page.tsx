import Link from "next/link"
import { UserPlus } from "lucide-react"
import { listPersonas } from "@/lib/domain/data/personas"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { PersonaCard } from "@/components/personas/PersonaCard"

export const dynamic = "force-dynamic"

export default async function PersonasPage() {
  const personas = await listPersonas()

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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
          New persona
        </Button>
      </header>

      {personas.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Create your first persona"
          description="A persona is the voice, audience, and point of view your content is written in."
          action={{ label: "New persona", href: "/personas/new" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
        </div>
      )}
    </main>
  )
}
