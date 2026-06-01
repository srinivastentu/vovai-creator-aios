import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { listPersonas } from "@/lib/domain/data/personas"
import { WorkspaceForm } from "@/components/workspaces/WorkspaceForm"

export const dynamic = "force-dynamic"

export default async function NewWorkspacePage() {
  const personas = await listPersonas()
  if (personas.length === 0) redirect("/personas/new")

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/workspaces"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Workspaces
      </Link>
      <h1 className="mb-8 font-heading text-2xl font-semibold">New workspace</h1>
      <WorkspaceForm personas={personas.map((p) => ({ id: p.id, name: p.name }))} />
    </main>
  )
}
