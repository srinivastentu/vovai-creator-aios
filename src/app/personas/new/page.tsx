import { PersonaForm } from "@/components/personas/PersonaForm"
import { AppFrame } from "@/components/shell/AppFrame"

export default function NewPersonaPage() {
  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-8 font-heading text-2xl font-semibold">New persona</h1>
      <PersonaForm />
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[
        { label: "Personas", href: "/personas" },
        { label: "New persona" },
      ]}
      left={left}
      previewTitle="Persona"
      previewEmpty={{
        title: "New persona",
        description: "Fill in the form, then create the persona.",
      }}
    />
  )
}
