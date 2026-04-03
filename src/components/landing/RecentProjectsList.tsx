"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Folder, ArrowRight } from "lucide-react"

type RecentProject = {
  id: string
  name: string
  status: string
  totalCostUSD: number
  createdAt: string
  blueprint: {
    id: string
    ideationPhase: string
    archetype: string
    moduleCount: number
  } | null
}

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  brainstorm: { label: "Brainstorming", color: "bg-amber-500/15 text-amber-400" },
  structure: { label: "Structuring", color: "bg-blue-500/15 text-blue-400" },
  refinement: { label: "Refining", color: "bg-purple-500/15 text-purple-400" },
  review: { label: "In Review", color: "bg-orange-500/15 text-orange-400" },
  approved: { label: "Approved", color: "bg-emerald-500/15 text-emerald-400" },
}

const ARCHETYPE_CONFIG: Record<string, { label: string; color: string }> = {
  k12_curriculum: { label: "K-12", color: "bg-cyan-500/15 text-cyan-400" },
  professional_training: { label: "Professional", color: "bg-indigo-500/15 text-indigo-400" },
  content_channel: { label: "Channel", color: "bg-pink-500/15 text-pink-400" },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function RecentProjectsList() {
  const router = useRouter()
  const [projects, setProjects] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.ok ? res.json() : [])
      .then((data: RecentProject[]) => setProjects(data.slice(0, 5)))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-12">
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) return null

  return (
    <div className="w-full max-w-2xl mx-auto mt-12">
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 px-1">
        Recent Projects
      </h2>
      <div className="space-y-1.5">
        {projects.map(project => {
          const phase = project.blueprint
            ? PHASE_CONFIG[project.blueprint.ideationPhase]
            : null
          const archetype = project.blueprint
            ? ARCHETYPE_CONFIG[project.blueprint.archetype]
            : null
          const moduleCount = project.blueprint?.moduleCount ?? 0

          return (
            <button
              key={project.id}
              onClick={() => router.push(`/project/${project.id}`)}
              className="w-full group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/5 border border-transparent hover:border-white/5"
            >
              <Folder className="size-5 text-gray-500 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {project.name}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {archetype && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${archetype.color}`}>
                      {archetype.label}
                    </span>
                  )}
                  {phase && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${phase.color}`}>
                      {phase.label}
                    </span>
                  )}
                  {moduleCount > 0 && (
                    <span className="text-[11px] text-gray-500">
                      {moduleCount} module{moduleCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {project.totalCostUSD > 0 && (
                    <span className="text-[11px] text-gray-500">
                      ${project.totalCostUSD.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[11px] text-gray-600 shrink-0">
                {formatDate(project.createdAt)}
              </span>

              <ArrowRight className="size-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
