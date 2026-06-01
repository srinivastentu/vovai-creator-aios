import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewIteration } from "./artifact-types"

// Cross-critique iteration history (the Gate B right rail). Per iteration: the two
// producer drafts, the cross-model critiques, the integrator's synthesis, the
// judge's per-dimension grade, and cost — sourced from the persisted StageSession /
// IterationRecord rows. Surfaces dialectic degradation (producersSucceeded < 2) and
// a skipped judge so a degraded iteration reads as such, not as a normal one.

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-xs leading-5 text-foreground/80">{text}</p>
    </div>
  )
}

function IterationCard({ it, expectedProducers }: { it: ReviewIteration; expectedProducers: number }) {
  const degraded = it.producersSucceeded < expectedProducers
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Iteration {it.version}</span>
        <span className="flex items-center gap-2">
          {it.judgeSkipped ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              judge skipped
            </span>
          ) : (
            <span className="text-sm font-semibold tabular-nums">{it.score ?? "—"}/100</span>
          )}
        </span>
      </div>

      {degraded ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3" />
          Degraded: {it.producersSucceeded} of {expectedProducers} producers returned a usable draft.
        </p>
      ) : null}

      {it.dimensions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {it.dimensions.map((d) => (
            <span
              key={d.name}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {d.name} {d.score}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {it.producers.map((p, i) => (
          <Snippet key={p.agentId} label={`Producer ${String.fromCharCode(65 + i)} · ${p.agentId}`} text={p.snippet} />
        ))}
        {it.critiques.map((c) => (
          <Snippet key={c.criticId} label={`Critique · ${c.criticId}`} text={c.snippet} />
        ))}
        {it.integratorSnippet ? (
          <Snippet label="Integrator (synthesis)" text={it.integratorSnippet} />
        ) : null}
      </div>

      <p className="mt-2 text-right text-[11px] text-muted-foreground tabular-nums">
        ${it.costUSD.toFixed(4)}
      </p>
    </li>
  )
}

export function IterationHistoryPanel({
  iterations,
  className,
}: {
  iterations: ReviewIteration[]
  className?: string
}) {
  // The configured producer count = the max seen across iterations (V1: 2).
  const expectedProducers = iterations.reduce((m, it) => Math.max(m, it.producers.length), 0) || 2

  return (
    <aside className={cn("h-fit rounded-lg border border-border p-3", className)}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Iteration history ({iterations.length})
      </p>
      {iterations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No iteration history. This artifact predates per-stage history capture, or
          was produced outside the cross-critique loop.
        </p>
      ) : (
        <ul className="space-y-2">
          {iterations.map((it) => (
            <IterationCard key={it.version} it={it} expectedProducers={expectedProducers} />
          ))}
        </ul>
      )}
    </aside>
  )
}
