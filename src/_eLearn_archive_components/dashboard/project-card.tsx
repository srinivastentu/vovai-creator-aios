import Link from "next/link"
import type { Project } from "@/lib/types"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, DollarSign, Layers } from "lucide-react"

const statusConfig: Record<
  Project["status"],
  { label: string; variant: "outline" | "default" | "secondary" }
> = {
  draft: { label: "Draft", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
}

const ringLabels: Record<number, string> = {
  0: "Setup",
  1: "Script",
  2: "Visual",
  3: "Audio + Assembly",
  4: "Finish",
  5: "Platform",
}

export function ProjectCard({ project }: { project: Project }) {
  const status = statusConfig[project.status]

  return (
    <Link href={`/project/${project.id}`} className="block">
      <Card className="transition-shadow hover:ring-foreground/20">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
          <CardDescription>{project.topic}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="size-3" />
              Ring {project.currentRing}
              {ringLabels[project.currentRing]
                ? ` — ${ringLabels[project.currentRing]}`
                : ""}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {project.durationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="size-3" />
              ${project.totalCostUSD.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Audience: {project.targetAudience}
          </p>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Created {project.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </CardFooter>
      </Card>
    </Link>
  )
}
