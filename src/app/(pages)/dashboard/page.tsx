import Link from "next/link"
import type { Project } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/dashboard/project-card"
import { Plus } from "lucide-react"

const sampleProjects: Project[] = [
  {
    id: "proj-001",
    name: "Workplace Safety Training",
    topic: "OSHA compliance and hazard identification for warehouse workers",
    targetAudience: "New warehouse employees",
    durationMinutes: 12,
    status: "in_progress",
    currentRing: 1,
    totalCostUSD: 2.47,
    createdAt: new Date("2026-03-25"),
  },
  {
    id: "proj-002",
    name: "Customer Service Excellence",
    topic: "Handling difficult customers and de-escalation techniques",
    targetAudience: "Retail staff",
    durationMinutes: 8,
    status: "draft",
    currentRing: 0,
    totalCostUSD: 0,
    createdAt: new Date("2026-03-27"),
  },
  {
    id: "proj-003",
    name: "Data Privacy Compliance",
    topic: "GDPR and data handling best practices for all employees",
    targetAudience: "All company staff",
    durationMinutes: 15,
    status: "completed",
    currentRing: 4,
    totalCostUSD: 18.93,
    createdAt: new Date("2026-03-10"),
  },
]

export default function DashboardPage() {
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sampleProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </main>
  )
}
