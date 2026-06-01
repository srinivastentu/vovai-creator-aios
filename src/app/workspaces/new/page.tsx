import { redirect } from "next/navigation"
import { listPersonas } from "@/lib/domain/data/personas"
import { WorkspaceForm } from "@/components/workspaces/WorkspaceForm"
import { AppFrame } from "@/components/shell/AppFrame"

export const dynamic = "force-dynamic"

export default async function NewWorkspacePage() {
  const personas = await listPersonas()
  if (personas.length === 0) redirect("/personas/new")

  const left = (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-8 font-heading text-2xl font-semibold">New workspace</h1>
      <WorkspaceForm personas={personas.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[
        { label: "Workspaces", href: "/workspaces" },
        { label: "New workspace" },
      ]}
      left={left}
      previewTitle="Workspace"
      previewEmpty={{
        title: "New workspace",
        description: "Name the workspace and pick the persona it writes as, then create it.",
      }}
    />
  )
}
