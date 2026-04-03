"use client"

import { useState, use } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Clock, DollarSign, Grid3X3, Layers, Lightbulb, Network, PanelLeft, Users, Waypoints } from "lucide-react"
import type { Project, StageSession, IterationRecord, Artifact, Grade, CostRecord } from "@/lib/types"
import { STAGES } from "@/lib/pipeline"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VersionA } from "@/components/project/version-a"
import { VersionB } from "@/components/project/version-b"
import { VersionC } from "@/components/project/version-c"

// --- Sample data (Visual-First: will be replaced with DB queries) ---

const ringLabels: Record<number, string> = {
  0: "Setup",
  1: "Script",
  2: "Visual",
  3: "Audio + Assembly",
  4: "Finish",
  5: "Platform",
}

const statusVariant: Record<Project["status"], "default" | "secondary" | "outline"> = {
  draft: "outline",
  in_progress: "default",
  completed: "secondary",
}

function makeMockArtifact(stage: string, version: number): Artifact {
  return {
    id: `art-${stage}-v${version}`,
    version,
    content: `Sample artifact for ${stage} v${version}`,
    stage,
    createdAt: new Date("2026-03-26"),
    metadata: {},
  }
}

function makeMockGrade(score: number): Grade {
  return {
    dimensions: [
      { name: "Accuracy", score: score + 0.3, weight: 0.25, reasoning: "Well-researched content" },
      { name: "Engagement", score: score - 0.2, weight: 0.2, reasoning: "Good narrative flow" },
      { name: "Pedagogy", score: score + 0.1, weight: 0.25, reasoning: "Clear learning objectives" },
      { name: "Structure", score: score, weight: 0.15, reasoning: "Logical progression" },
      { name: "Clarity", score: score + 0.5, weight: 0.15, reasoning: "Accessible language" },
    ],
    compositeScore: score,
    overallAssessment: `Solid work scoring ${score}/10`,
    improvementPriorities: score < 8 ? ["Improve engagement hooks"] : [],
  }
}

function makeMockCost(usd: number): CostRecord {
  return { model: "claude-sonnet-4-20250514", inputTokens: 2400, outputTokens: 1800, costUSD: usd }
}

function makeMockIteration(num: number, stage: string, score: number, cost: number): IterationRecord {
  return {
    iteration: num,
    artifact: makeMockArtifact(stage, num),
    grade: makeMockGrade(score),
    outcome: score >= 7.5 ? "presented" : "revised",
    cost: makeMockCost(cost),
  }
}

const sampleProject: Project = {
  id: "proj-001",
  name: "Workplace Safety Training",
  topic: "OSHA compliance and hazard identification for warehouse workers",
  targetAudience: "New warehouse employees",
  durationMinutes: 12,
  status: "in_progress",
  currentRing: 1,
  totalCostUSD: 2.47,
  createdAt: new Date("2026-03-25"),
}

const sampleSessions: StageSession[] = STAGES.map((stage) => {
  if (stage.id === 1) {
    return {
      id: "sess-001",
      projectId: "proj-001",
      stageId: 1,
      status: "approved" as const,
      iterations: [
        makeMockIteration(1, "discovery", 6.8, 0.32),
        makeMockIteration(2, "discovery", 7.9, 0.28),
        makeMockIteration(3, "discovery", 8.4, 0.25),
      ],
      currentArtifact: makeMockArtifact("discovery", 3),
      bestArtifact: makeMockArtifact("discovery", 3),
      bestGrade: makeMockGrade(8.4),
      metadata: null,
    }
  }
  if (stage.id === 2) {
    return {
      id: "sess-002",
      projectId: "proj-001",
      stageId: 2,
      status: "approved" as const,
      iterations: [
        makeMockIteration(1, "script", 7.1, 0.45),
        makeMockIteration(2, "script", 8.2, 0.38),
      ],
      currentArtifact: makeMockArtifact("script", 2),
      bestArtifact: makeMockArtifact("script", 2),
      bestGrade: makeMockGrade(8.2),
      metadata: null,
    }
  }
  if (stage.id === 3) {
    return {
      id: "sess-003",
      projectId: "proj-001",
      stageId: 3,
      status: "awaiting_review" as const,
      iterations: [],
      currentArtifact: null,
      bestArtifact: null,
      bestGrade: null,
      metadata: null,
    }
  }
  return {
    id: `sess-${String(stage.id).padStart(3, "0")}`,
    projectId: "proj-001",
    stageId: stage.id,
    status: "idle" as const,
    iterations: [],
    currentArtifact: null,
    bestArtifact: null,
    bestGrade: null,
    metadata: null,
  }
})

// --- Tab config ---

type ViewTab = "grid" | "timeline" | "sidebar"

const tabs: { key: ViewTab; label: string; icon: typeof Grid3X3 }[] = [
  { key: "grid", label: "Grid", icon: Grid3X3 },
  { key: "timeline", label: "Timeline", icon: Waypoints },
  { key: "sidebar", label: "Sidebar", icon: PanelLeft },
]

// --- Page Component ---

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [activeTab, setActiveTab] = useState<ViewTab>("grid")

  // TODO: Replace with DB query
  const project = sampleProject
  const sessions = sampleSessions

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Projects
        </Link>

        {/* Project header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <CardDescription className="mt-1">{project.topic}</CardDescription>
              </div>
              <Badge variant={statusVariant[project.status]}>
                {project.status.replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers size={14} />
                Ring {project.currentRing} — {ringLabels[project.currentRing]}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                {project.targetAudience}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {project.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign size={14} />
                ${project.totalCostUSD.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Project Component section */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb size={16} className="text-amber-500" />
                  Project Component
                </CardTitle>
                <CardDescription className="mt-1">
                  Design, structure, configure, and launch your learning components
                </CardDescription>
              </div>
              <Link href={`/project/${id}/ideation`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Open
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/project/${id}/ideation`}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Lightbulb size={14} className="text-amber-500" />
                Ideation
              </Link>
              <Link
                href={`/project/${id}/structure`}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Network size={14} className="text-blue-500" />
                Structure
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* View toggle tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Active view */}
        {activeTab === "grid" && <VersionA sessions={sessions} />}
        {activeTab === "timeline" && <VersionB sessions={sessions} />}
        {activeTab === "sidebar" && <VersionC sessions={sessions} />}
      </div>
    </main>
  )
}
