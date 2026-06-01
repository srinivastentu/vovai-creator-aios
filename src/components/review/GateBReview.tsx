"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import type { ArtifactType } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"
import { submitGateBReview, regenerateArtifact } from "@/lib/domain/data/artifact-actions"
import { ArtifactStatusBadge } from "./ArtifactStatusBadge"
import { ArtifactEditor } from "./ArtifactEditor"
import { IterationHistoryPanel } from "./IterationHistoryPanel"
import { DiffView, type DiffVersion } from "./DiffView"
import { GateBActions } from "./GateBActions"
import type { ReviewArtifact } from "./artifact-types"

const TYPE_LABEL: Record<ArtifactType, string> = {
  linkedin_post: "LinkedIn post",
  long_form_article: "Long-form article",
}

const DERIVED_LABEL: Record<string, string> = {
  cross_critique: "cross-critique",
  inline_edit: "edited",
  regenerate: "regenerated",
  merge: "merged",
}

// Gate B review shell: top meta bar · center inline editor · right iteration-history
// panel · branches + diff section · sticky action bar. All review state (editor
// body, busy, regenerating) lives here; the children are presentational.
export function GateBReview({ artifact }: { artifact: ReviewArtifact }) {
  const router = useRouter()
  const [body, setBody] = useState(artifact.body)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const awaiting = artifact.status === "awaiting_review"
  const dirty = body !== artifact.body
  const ws = artifact.workspaceId

  async function run(action: () => Promise<{ ideaCompleted?: boolean }>, successMsg: string) {
    setBusy(true)
    try {
      const res = await action()
      toast.success(successMsg)
      if (res.ideaCompleted) toast.success("Both artifacts approved — idea marked complete. 🎉")
      router.push(`/workspaces/${ws}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.")
      setBusy(false)
    }
  }

  const handleApprove = () =>
    run(
      () =>
        dirty
          ? submitGateBReview(artifact.id, { type: "inline_edit", content: body })
          : submitGateBReview(artifact.id, { type: "approve" }),
      dirty ? "Edits saved — artifact approved." : "Artifact approved.",
    )

  const handleRequestChanges = (message: string) =>
    run(
      () => submitGateBReview(artifact.id, { type: "feedback", message }),
      "Changes requested — artifact returned to draft.",
    )

  const handleReject = (reason: string) =>
    run(
      () => submitGateBReview(artifact.id, { type: "reject", message: reason || undefined }),
      "Artifact rejected.",
    )

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const { regeneratedArtifactId } = await regenerateArtifact(artifact.id, body)
      toast.success("Regenerated — a new branch is ready to review.")
      router.push(`/workspaces/${ws}/artifacts/${regeneratedArtifactId}/review`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed.")
      setRegenerating(false)
    }
  }

  const showTermination =
    artifact.terminationReason !== null && artifact.terminationReason !== "threshold_met"

  const diffVersions: DiffVersion[] = artifact.branches.map((b) => ({
    id: b.id,
    label: `${DERIVED_LABEL[b.derivedVia] ?? b.derivedVia}${b.isCurrent ? " (current)" : ""} · ${b.status}`,
    body: b.body,
  }))

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 pb-24">
      <Link
        href={`/workspaces/${ws}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {artifact.workspaceName}
      </Link>

      {/* Top meta bar */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {TYPE_LABEL[artifact.artifactType]}
          </span>
          <ArtifactStatusBadge status={artifact.status} />
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {DERIVED_LABEL[artifact.derivedVia] ?? artifact.derivedVia}
          </span>
          <h1 className="font-heading text-2xl font-semibold">{artifact.masterTitle}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Gate B · per-artifact review · idea: {artifact.ideaTitle}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground tabular-nums">
          <span>
            Best score:{" "}
            <span className="font-medium text-foreground">
              {artifact.bestScore !== null ? `${artifact.bestScore}/100` : "—"}
            </span>
          </span>
          <span>Cost: ${artifact.costUSD.toFixed(4)}</span>
          <span>Iterations: {artifact.iterationCount}</span>
          {showTermination ? (
            <span className="text-amber-700 dark:text-amber-400">
              Stopped: {artifact.terminationReason}
            </span>
          ) : null}
        </div>
      </div>

      {!awaiting ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">
            This artifact is {artifact.status.replace("_", " ")}. Gate B actions are
            unavailable.
          </p>
          {artifact.reviewFeedback ? (
            <p className="mt-1 text-muted-foreground">
              Reviewer note: “{artifact.reviewFeedback}”
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Center editor + right history panel */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-lg border border-border p-5">
          <ArtifactEditor
            type={artifact.artifactType}
            value={body}
            onChange={setBody}
            editable={awaiting}
          />
        </section>

        <IterationHistoryPanel iterations={artifact.iterations} />
      </div>

      {/* Branches + diff */}
      {artifact.branches.length > 1 ? (
        <section className="mt-6 rounded-lg border border-border p-5">
          <h2 className="font-medium">Branches</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Fork lineage for this {TYPE_LABEL[artifact.artifactType].toLowerCase()}. Flip
            between branches; diff any two below.
          </p>
          <ul className="mb-4 flex flex-wrap gap-2">
            {artifact.branches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/workspaces/${ws}/artifacts/${b.id}/review`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
                    b.isCurrent
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  <span className="font-medium">{DERIVED_LABEL[b.derivedVia] ?? b.derivedVia}</span>
                  <span className="text-muted-foreground">· {b.status}</span>
                  {b.bestScore !== null ? (
                    <span className="text-muted-foreground tabular-nums">· {b.bestScore}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <DiffView versions={diffVersions} />
        </section>
      ) : null}

      {awaiting ? (
        <GateBActions
          busy={busy}
          regenerating={regenerating}
          dirty={dirty}
          onApprove={handleApprove}
          onRequestChanges={handleRequestChanges}
          onReject={handleReject}
          onRegenerate={handleRegenerate}
        />
      ) : null}
    </main>
  )
}
