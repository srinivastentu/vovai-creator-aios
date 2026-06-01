import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getPersona } from "@/lib/domain/data/personas"
import { personaToFormValues } from "@/lib/domain/persona-schema"
import { PersonaForm } from "@/components/personas/PersonaForm"

export const dynamic = "force-dynamic"

export default async function EditPersonaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const persona = await getPersona(id)
  if (!persona) notFound()

  const initial = personaToFormValues(persona)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/personas"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Personas
      </Link>
      <h1 className="mb-8 font-heading text-2xl font-semibold">{persona.name}</h1>
      <PersonaForm initial={initial} personaId={persona.id} />
    </main>
  )
}
