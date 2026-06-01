import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PersonaForm } from "@/components/personas/PersonaForm"

export default function NewPersonaPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/personas"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Personas
      </Link>
      <h1 className="mb-8 font-heading text-2xl font-semibold">New persona</h1>
      <PersonaForm />
    </main>
  )
}
