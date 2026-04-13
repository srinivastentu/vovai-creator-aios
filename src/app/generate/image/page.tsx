'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  { id: 'widescreen', name: 'Widescreen', width: 1280, height: 720 }
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
  idle: 'Ready',
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

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Image Generation</h1>
          <p className="text-sm text-muted-foreground">
            Describe an image. Multiple models compete. Best one wins.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total cost</div>
          <div className="text-lg font-mono">${state.costSoFar.toFixed(4)}</div>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A red cube on a white table, studio lighting, photorealistic"
            rows={3}
            maxLength={2000}
            disabled={running}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {prompt.length} / 2000
            </div>
            <div className="flex gap-2">
              <Button onClick={onGenerate} disabled={!canGenerate}>
                Generate
              </Button>
              {running && (
                <Button variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              )}
              {state.status !== 'idle' && !running && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPrompt('')
                    setExpandedEntry(null)
                    reset()
                  }}
                >
                  New session
                </Button>
              )}
              <Badge variant="secondary">
                {STATUS_LABEL[state.status] ?? state.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Models</CardTitle>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary underline underline-offset-2"
            disabled={models.length === 0}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        </CardHeader>
        <CardContent>
          {modelsError && (
            <div className="text-sm text-destructive">{modelsError}</div>
          )}
          {!modelsError && models.length === 0 && (
            <div className="text-sm text-muted-foreground">Loading models…</div>
          )}
          <div className="flex flex-wrap gap-2">
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
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    on
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                  title={
                    downgraded
                      ? `${m.providerId} · ${m.qualityTier} — will produce ${closest!.width}×${closest!.height} (closest supported)`
                      : `${m.providerId} · ${m.qualityTier}`
                  }
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {m.providerId}
                  </span>
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                    {m.qualityTier}
                  </span>
                  {downgraded && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      ↓ {closest!.width}×{closest!.height}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-sm font-medium text-left"
          >
            {advanced ? '▾' : '▸'} Advanced settings
          </button>
        </CardHeader>
        {advanced && (
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">Format</div>
              <div className="flex flex-wrap gap-2">
                {FORMAT_PRESETS.map((p) => {
                  const on = p.id === formatId
                  const ratio = p.width / p.height
                  const w = ratio >= 1 ? 28 : Math.round(28 * ratio)
                  const h = ratio >= 1 ? Math.round(28 / ratio) : 28
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormatId(p.id)}
                      disabled={running}
                      className={`flex min-w-[120px] flex-col items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors ${
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <div
                        aria-hidden
                        className={`rounded-sm border ${on ? 'border-primary bg-primary/30' : 'border-foreground/40 bg-foreground/10'}`}
                        style={{ width: `${w}px`, height: `${h}px` }}
                      />
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.width}×{p.height}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Max rounds</span>
              <input
                type="number"
                min={1}
                max={3}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                disabled={running}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Threshold (0–10)</span>
              <input
                type="number"
                min={5}
                max={10}
                step={0.25}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                disabled={running}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Top N for next round</span>
              <input
                type="number"
                min={1}
                max={3}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                disabled={running}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            </div>
          </CardContent>
        )}
      </Card>

      {state.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {state.error}
          </CardContent>
        </Card>
      )}

      {(running || state.feed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {running && (
                <span
                  aria-label="working"
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                />
              )}
              <span>
                {state.maxRounds > 0
                  ? `Round ${state.currentRound || 1} of ${state.maxRounds}`
                  : 'Progress'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto font-mono text-xs space-y-1">
              {state.feed.slice(-20).map((f, i) => (
                <div key={`${f.ts}-${i}`} className="text-muted-foreground">
                  <span className="text-foreground/70">
                    {new Date(f.ts).toLocaleTimeString()}
                  </span>{' '}
                  {f.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={approve}
                className="bg-green-600 hover:bg-green-700 text-white"
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
                    setPrompt('')
                    reset()
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
                  Regenerate
                </Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Method: {state.result.method} · Total:{' '}
              ${state.result.totalCostUsd.toFixed(4)}
            </div>
          </CardContent>
        </Card>
      )}

      {state.status === 'approved' && (
        <Card className="border-green-600">
          <CardContent className="pt-6 text-green-700 font-medium">
            Approved. Total cost: ${state.costSoFar.toFixed(4)}.
          </CardContent>
        </Card>
      )}

      <FullscreenDialog
        entry={fullscreen}
        onClose={() => setFullscreen(null)}
      />

      {state.status === 'failed' && (
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-2">
            <div className="font-medium text-destructive">
              All models failed to produce a usable image.
            </div>
            <div className="text-sm text-muted-foreground">
              Check that provider API keys are configured and try again.
            </div>
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
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
  const errorReason =
    !genOk
      ? entry.gatewayResponse?.error ?? 'Generation failed'
      : validationFailed
        ? entry.validatorResult?.errors.join('; ') ?? 'Validation failed'
        : null

  return (
    <Card
      className={`overflow-hidden transition-all ${
        isWinner ? 'ring-2 ring-green-500' : ''
      } ${errorReason ? 'opacity-70' : ''}`}
    >
      <div className="relative aspect-square w-full bg-muted">
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
              className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {errorReason ?? 'No image'}
          </div>
        )}
        {isWinner && (
          <div className="absolute left-2 top-2 rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
            Winner
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
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm">{entry.modelId}</div>
          <div className="flex gap-1">
            <Badge variant="secondary">R{entry.round}</Badge>
            {grade && (
              <Badge className="bg-primary text-primary-foreground">
                {grade.overallScore.toFixed(2)}
              </Badge>
            )}
          </div>
        </div>
        {!grade && genOk && !validationFailed && (
          <div className="text-xs text-muted-foreground">Judging…</div>
        )}
        {validationFailed && (
          <div className="text-xs text-red-600">
            Validation failed: {entry.validatorResult?.errors.join('; ')}
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
      </CardContent>
    </Card>
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
