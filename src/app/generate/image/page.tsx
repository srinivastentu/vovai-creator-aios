'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  useImageTournament,
  type ClientEntry,
} from '@/hooks/useImageTournament'
import { pickClosestResolution, resolutionsEqual } from '@/lib/core/models/resolution-utils'

interface FormatPreset {
  id: string
  name: string
  width: number
  height: number
}

const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'square', name: 'Square', width: 1024, height: 1024 },
  { id: 'landscape-hd', name: 'Landscape HD', width: 1792, height: 1024 },
  { id: 'full-hd', name: 'Full HD', width: 1920, height: 1080 },
  { id: 'portrait', name: 'Portrait', width: 1024, height: 1792 },
  { id: 'widescreen', name: 'Widescreen', width: 1280, height: 720 },
]

function slugifyPrompt(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/g, '') || 'image'
  )
}

function extFromUrl(url: string): string {
  const last = decodeURIComponent(url.split('/').pop() ?? '')
  const m = /\.([a-z0-9]+)$/i.exec(last)
  return m ? m[1].toLowerCase() : 'png'
}

function downloadFilename(entry: ClientEntry): string {
  const slug = slugifyPrompt(entry.artifact?.prompt ?? '')
  const ext = entry.imageUrl ? extFromUrl(entry.imageUrl) : 'png'
  return `${slug}-${entry.modelId}-r${entry.round}.${ext}`
}

interface AvailableModel {
  id: string
  name: string
  providerId: string
  qualityTier: string
  status: string
  resolutions: string[]
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  starting: 'Starting…',
  running: 'Running',
  complete: 'Ready for review',
  failed: 'All models failed',
  approved: 'Approved',
  error: 'Error',
}

export default function ImageGeneratePage() {
  const { state, generate, cancel, reset, approve } = useImageTournament()
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<AvailableModel[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [maxRounds, setMaxRounds] = useState(2)
  const [threshold, setThreshold] = useState(7.5)
  const [topN, setTopN] = useState(2)
  const [formatId, setFormatId] = useState<string>('square')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState<ClientEntry | null>(null)
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/generate/image/models')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json?.success && Array.isArray(json.data?.models)) {
          const list: AvailableModel[] = json.data.models
          setModels(list)
          setSelected(new Set(list.map((m) => m.id)))
        } else {
          setModelsError(json?.error?.message ?? 'Failed to load models')
        }
      })
      .catch((e) => {
        if (!cancelled) setModelsError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => reset(), [reset])

  const running = state.status === 'starting' || state.status === 'running'
  const canGenerate =
    prompt.trim().length > 0 && selected.size > 0 && !running

  const format =
    FORMAT_PRESETS.find((p) => p.id === formatId) ?? FORMAT_PRESETS[0]

  const generateOpts = () => ({
    modelIds: Array.from(selected),
    maxRounds,
    threshold,
    topN,
    width: format.width,
    height: format.height,
  })

  const onGenerate = () => {
    if (!canGenerate) return
    setExpandedEntry(null)
    generate(prompt, generateOpts())
  }

  const onRegenerateWithFeedback = () => {
    const trimmed = feedback.trim()
    const newPrompt = trimmed
      ? `${prompt}\n\nUser guidance: ${trimmed}`
      : prompt
    setFeedback('')
    setShowFeedback(false)
    setExpandedEntry(null)
    generate(newPrompt, generateOpts())
  }

  const onNewSession = () => {
    setPrompt('')
    setExpandedEntry(null)
    reset()
  }

  const toggleModel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = selected.size === models.length && models.length > 0
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(models.map((m) => m.id)))
  }

  const winnerKey = useMemo(() => {
    const w = state.result?.winner ?? state.result?.bestEntry ?? null
    return w ? `${w.modelId}::${w.round}` : null
  }, [state.result])

  const statusText =
    state.status === 'idle'
      ? 'Idle'
      : running && state.maxRounds > 0
        ? `Round ${state.currentRound || 1} of ${state.maxRounds}`
        : state.status === 'complete'
          ? `Complete — ${state.result?.method ?? 'done'}`
          : STATUS_LABEL[state.status] ?? state.status

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold">Image Generation</h1>
          <p className="text-xs text-muted-foreground">
            Describe an image. Multiple models compete. Best one wins.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total cost
          </div>
          <div className="font-mono text-base">${state.costSoFar.toFixed(4)}</div>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* LEFT — INPUT */}
        <aside className="flex w-full shrink-0 flex-col border-b border-border md:h-full md:w-[400px] md:border-b-0 md:border-r">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Prompt */}
            <section>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prompt
              </label>
              <div className="relative">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A red cube on a white table, studio lighting, photorealistic"
                  rows={5}
                  maxLength={2000}
                  disabled={running}
                  className="resize-none pr-16"
                />
                <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                  {prompt.length}/2000
                </div>
              </div>
            </section>

            {/* Models */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Models
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] text-primary underline underline-offset-2 disabled:opacity-50"
                  disabled={models.length === 0}
                >
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              </div>
              {modelsError && (
                <div className="text-xs text-destructive">{modelsError}</div>
              )}
              {!modelsError && models.length === 0 && (
                <div className="text-xs text-muted-foreground">Loading models…</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {models.map((m) => {
                  const on = selected.has(m.id)
                  const closest = pickClosestResolution(m.resolutions, {
                    width: format.width,
                    height: format.height,
                  })
                  const downgraded =
                    closest !== null &&
                    !resolutionsEqual(closest, {
                      width: format.width,
                      height: format.height,
                    })
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModel(m.id)}
                      disabled={running}
                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      } disabled:opacity-50`}
                      title={
                        downgraded
                          ? `${m.providerId} · ${m.qualityTier} — will produce ${closest!.width}×${closest!.height}`
                          : `${m.providerId} · ${m.qualityTier}`
                      }
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase">
                        {m.qualityTier}
                      </span>
                      {downgraded && (
                        <span className="ml-1 text-[9px] text-amber-700">
                          ↓{closest!.width}×{closest!.height}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Format */}
            <section>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Format
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FORMAT_PRESETS.map((p) => {
                  const on = p.id === formatId
                  const ratio = p.width / p.height
                  const w = ratio >= 1 ? 24 : Math.round(24 * ratio)
                  const h = ratio >= 1 ? Math.round(24 / ratio) : 24
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormatId(p.id)}
                      disabled={running}
                      className={`flex shrink-0 flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] transition-all ${
                        on
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                          : 'border-border hover:bg-muted'
                      } disabled:opacity-50`}
                    >
                      <div
                        aria-hidden
                        className={`rounded-sm border ${on ? 'border-primary bg-primary/40' : 'border-foreground/40 bg-foreground/10'}`}
                        style={{ width: `${w}px`, height: `${h}px` }}
                      />
                      <div className="font-medium">{p.name}</div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Advanced */}
            <section>
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                <span>{advanced ? '▾' : '▸'}</span>
                <span>Advanced settings</span>
              </button>
              {advanced && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-[11px]">
                    <span className="text-muted-foreground">Max rounds</span>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={maxRounds}
                      onChange={(e) => setMaxRounds(Number(e.target.value))}
                      disabled={running}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px]">
                    <span className="text-muted-foreground">Threshold</span>
                    <input
                      type="number"
                      min={5}
                      max={10}
                      step={0.25}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      disabled={running}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px]">
                    <span className="text-muted-foreground">Top N</span>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={topN}
                      onChange={(e) => setTopN(Number(e.target.value))}
                      disabled={running}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              )}
            </section>
          </div>

          {/* Action buttons — pinned bottom */}
          <div className="shrink-0 border-t border-border bg-background p-4">
            {running ? (
              <Button
                variant="outline"
                onClick={cancel}
                className="w-full"
              >
                Cancel
              </Button>
            ) : state.status !== 'idle' ? (
              <div className="space-y-2">
                <Button onClick={onGenerate} disabled={!canGenerate} className="w-full">
                  Generate again
                </Button>
                <Button variant="outline" onClick={onNewSession} className="w-full">
                  New session
                </Button>
              </div>
            ) : (
              <Button onClick={onGenerate} disabled={!canGenerate} className="w-full">
                Generate
              </Button>
            )}
          </div>
        </aside>

        {/* RIGHT — RESULTS */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Status bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-5 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              {running && (
                <span
                  aria-label="working"
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                />
              )}
              <span className="font-medium">{statusText}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-muted-foreground">
                ${state.costSoFar.toFixed(4)}
              </span>
              <Badge variant="secondary">{STATUS_LABEL[state.status] ?? state.status}</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {state.error && (
              <div className="mb-4 rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {state.entries.length === 0 && !running && (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-sm space-y-2 text-muted-foreground">
                  <div className="text-lg font-medium">No results yet</div>
                  <p className="text-sm">
                    Enter a prompt on the left, pick models, and hit Generate.
                    Outputs will stream in here as each model finishes.
                  </p>
                </div>
              </div>
            )}

            {state.entries.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {state.entries.map((entry) => {
                  const key = `${entry.modelId}::${entry.round}`
                  return (
                    <ImageCard
                      key={key}
                      entry={entry}
                      isWinner={winnerKey === key}
                      expanded={expandedEntry === key}
                      onToggle={() =>
                        setExpandedEntry((prev) => (prev === key ? null : key))
                      }
                      onOpenFullscreen={() => setFullscreen(entry)}
                    />
                  )
                })}
              </div>
            )}

            {state.status === 'complete' && state.result && (
              <div className="mt-5 space-y-3 rounded-md border border-border bg-muted/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Review
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={approve}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Approve winner
                  </Button>
                  {(() => {
                    const w = state.result.winner ?? state.result.bestEntry
                    if (!w || !w.imageUrl) return null
                    return (
                      <a
                        href={w.imageUrl}
                        download={downloadFilename(w)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                      >
                        <DownloadIcon className="h-4 w-4" /> Download winner
                      </a>
                    )
                  })()}
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedback((v) => !v)}
                    className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  >
                    Regenerate with feedback
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generate(prompt, generateOpts())}
                  >
                    Regenerate (same prompt)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Discard this tournament and start fresh?')) {
                        onNewSession()
                      }
                    }}
                    className="border-red-500 text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                </div>
                {showFeedback && (
                  <div className="space-y-2">
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="e.g. make it more vibrant; reduce clutter"
                      rows={2}
                    />
                    <Button
                      onClick={onRegenerateWithFeedback}
                      disabled={feedback.trim().length === 0}
                    >
                      Run
                    </Button>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Method: {state.result.method} · Total: $
                  {state.result.totalCostUsd.toFixed(4)}
                </div>
              </div>
            )}

            {state.status === 'approved' && (
              <div className="mt-5 rounded-md border border-green-600 bg-green-50 p-4 text-sm font-medium text-green-700">
                Approved. Total cost: ${state.costSoFar.toFixed(4)}.
              </div>
            )}

            {state.status === 'failed' && (
              <div className="mt-5 space-y-2 rounded-md border border-destructive bg-destructive/5 p-4">
                <div className="font-medium text-destructive">
                  All models failed to produce a usable image.
                </div>
                <div className="text-sm text-muted-foreground">
                  Check that provider API keys are configured and try again.
                </div>
              </div>
            )}

            {/* Event log */}
            {state.feed.length > 0 && (
              <div className="mt-5 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setLogOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                >
                  <span>{logOpen ? '▾' : '▸'} Event log ({state.feed.length})</span>
                </button>
                {logOpen && (
                  <div className="max-h-60 space-y-1 overflow-y-auto border-t border-border bg-muted/20 p-3 font-mono text-xs">
                    {state.feed.map((f, i) => (
                      <div key={`${f.ts}-${i}`} className="text-muted-foreground">
                        <span className="text-foreground/70">
                          {new Date(f.ts).toLocaleTimeString()}
                        </span>{' '}
                        {f.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <FullscreenDialog
        entry={fullscreen}
        onClose={() => setFullscreen(null)}
      />
    </div>
  )
}

function ImageCard({
  entry,
  isWinner,
  expanded,
  onToggle,
  onOpenFullscreen,
}: {
  entry: ClientEntry
  isWinner: boolean
  expanded: boolean
  onToggle: () => void
  onOpenFullscreen: () => void
}) {
  const url = entry.imageUrl
  const genOk = entry.gatewayResponse?.success && !!url
  const validationFailed =
    entry.validatorResult != null && !entry.validatorResult.passed
  const grade = entry.grade
  const rawGenError = entry.gatewayResponse?.error ?? null
  const shortGenError = entry.errorShort ?? rawGenError
  const errorReason = !genOk
    ? shortGenError ?? 'Generation failed'
    : validationFailed
      ? entry.validatorResult?.errors.join('; ') ?? 'Validation failed'
      : null
  const errorDetail = !genOk ? rawGenError : validationFailed ? entry.validatorResult?.errors.join('; ') ?? null : null
  const showDetailToggle = errorReason != null && errorDetail != null && errorDetail !== errorReason

  return (
    <div
      className={`overflow-hidden rounded-md border bg-card transition-all ${
        isWinner ? 'ring-2 ring-green-500' : 'border-border'
      } ${errorReason ? 'opacity-80' : ''}`}
    >
      <div className="relative h-[300px] w-full bg-muted">
        {url && genOk ? (
          <button
            type="button"
            onClick={onOpenFullscreen}
            aria-label="View full size"
            className="group block h-full w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${entry.modelId} round ${entry.round}`}
              className={`h-full w-full object-cover transition-opacity group-hover:opacity-90 ${
                errorReason ? 'grayscale' : ''
              }`}
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {errorReason ?? 'No image'}
          </div>
        )}

        {isWinner && (
          <div className="absolute left-2 top-2 rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
            Winner
          </div>
        )}

        {errorReason && url && (
          <div className="absolute inset-x-2 top-2 rounded bg-red-600/90 px-2 py-1 text-xs font-medium text-white">
            {validationFailed ? `Validation Failed: ${errorReason}` : 'Failed'}
          </div>
        )}

        {grade && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-lg font-bold text-white backdrop-blur-sm">
            {grade.overallScore.toFixed(2)}
          </div>
        )}

        {url && genOk && (
          <a
            href={url}
            download={downloadFilename(entry)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Download image"
            title="Download"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium" title={entry.modelId}>
            {entry.modelId}
          </div>
          <div className="flex shrink-0 gap-1">
            <Badge variant="secondary" className="text-[10px]">
              R{entry.round}
            </Badge>
          </div>
        </div>

        {!grade && genOk && !validationFailed && (
          <div className="text-xs text-muted-foreground">Judging…</div>
        )}

        {errorReason && (
          <div className="space-y-1">
            <div className="text-xs text-red-600" title={errorDetail ?? undefined}>
              {errorReason}
            </div>
            {showDetailToggle && (
              <>
                <button
                  type="button"
                  onClick={onToggle}
                  className="text-[11px] text-primary underline underline-offset-2"
                >
                  {expanded ? 'Hide details' : 'See details'}
                </button>
                {expanded && errorDetail && (
                  <div className="mt-1 whitespace-pre-wrap break-words rounded border border-border bg-muted p-2 text-[11px] text-muted-foreground">
                    {errorDetail}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {grade && (
          <div>
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-primary underline underline-offset-2"
            >
              {expanded ? 'Hide details' : 'Details'}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2 rounded border border-border p-2 text-xs">
                <div className="space-y-1">
                  {grade.dimensionScores.map((d) => (
                    <div key={d.dimensionId}>
                      <div className="flex justify-between">
                        <span className="font-medium">{d.name}</span>
                        <span className="font-mono">
                          {d.score.toFixed(2)} · w{d.weight}
                        </span>
                      </div>
                      {d.feedback && (
                        <div className="text-muted-foreground">{d.feedback}</div>
                      )}
                    </div>
                  ))}
                </div>
                {grade.recommendation && (
                  <div>
                    <span className="font-medium">Verdict:</span>{' '}
                    {grade.recommendation}
                  </div>
                )}
                {grade.improvementPriorities.length > 0 && (
                  <div>
                    <span className="font-medium">Improve:</span>{' '}
                    {grade.improvementPriorities.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          cost: ${(entry.gatewayResponse?.cost?.costUsd ?? 0).toFixed(4)}
        </div>
      </div>
    </div>
  )
}

function FullscreenDialog({
  entry,
  onClose,
}: {
  entry: ClientEntry | null
  onClose: () => void
}) {
  const open = entry !== null
  const url = entry?.imageUrl ?? null
  const grade = entry?.grade ?? null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-[90vw] w-auto overflow-hidden p-0 gap-0">
        <DialogTitle className="sr-only">
          {entry ? `${entry.modelId} — round ${entry.round}` : 'Image preview'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Full-size generated image with grade breakdown.
        </DialogDescription>
        {entry && url && (
          <div className="flex max-h-[90vh] flex-col">
            <div className="flex items-center justify-center bg-black/90 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${entry.modelId} round ${entry.round}`}
                className="max-h-[65vh] max-w-full object-contain"
              />
            </div>
            <div className="max-h-[25vh] overflow-y-auto p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{entry.modelId}</div>
                  <div className="text-xs text-muted-foreground">
                    Round {entry.round}
                    {grade && ` · score ${grade.overallScore.toFixed(2)}/10`}
                  </div>
                </div>
                <a
                  href={url}
                  download={downloadFilename(entry)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <DownloadIcon className="h-4 w-4" /> Download
                </a>
              </div>
              {grade && (
                <div className="space-y-1 text-xs">
                  {grade.dimensionScores.map((d) => (
                    <div key={d.dimensionId} className="flex justify-between">
                      <span className="font-medium">{d.name}</span>
                      <span className="font-mono">
                        {d.score.toFixed(2)} · w{d.weight}
                      </span>
                    </div>
                  ))}
                  {grade.recommendation && (
                    <div className="pt-1">
                      <span className="font-medium">Verdict:</span>{' '}
                      {grade.recommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
