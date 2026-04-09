'use client'

import Link from "next/link"
import { Plus, Loader2, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/dashboard/project-card"
import { useApi } from "@/lib/hooks/use-api"
import { ErrorBanner } from "@/components/project-component/shared/error-banner"
import { EmptyState } from "@/components/project-component/shared/empty-state"
import type { Project } from "@/lib/types"

type ProjectResponse = Omit<Project, 'createdAt'> & { createdAt: string }

export default function DashboardPage() {
  const { data, loading, error, refetch } = useApi<ProjectResponse[]>('/api/projects')

  const projects: Project[] = (data ?? []).map(p => ({
    ...p,
    createdAt: new Date(p.createdAt),
  }))

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Your eLearning video productions
            </p>
          </div>
          <Button size="lg" nativeButton={false} render={<Link href="/project/new" />}>
            <Plus className="size-4" />
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
            <span className="text-sm text-muted-foreground">Loading projects...</span>
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={refetch} variant="card" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No projects yet"
            description="Create your first eLearning project to get started."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
