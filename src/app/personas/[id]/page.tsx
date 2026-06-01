import { notFound } from "next/navigation"
import { getPersona } from "@/lib/domain/data/personas"
import { personaToFormValues } from "@/lib/domain/persona-schema"
import { PersonaForm } from "@/components/personas/PersonaForm"
import { AppFrame } from "@/components/shell/AppFrame"
import { PersonaPreview } from "@/components/shell/previews/PersonaPreview"

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

  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-8 font-heading text-2xl font-semibold">{persona.name}</h1>
      <PersonaForm initial={initial} personaId={persona.id} />
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[
        { label: "Personas", href: "/personas" },
        { label: persona.name },
      ]}
      left={left}
      preview={<PersonaPreview persona={initial} />}
      previewTitle="Persona"
    />
  )
}
