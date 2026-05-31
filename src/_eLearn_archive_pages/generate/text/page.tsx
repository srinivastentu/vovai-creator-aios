'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTextGeneration, type IterationSummary } from '@/hooks/useTextGeneration'

export default function TextGeneratePage() {
  const { state, generate, submitReview, reset, cancel } = useTextGeneration()
  const [goal, setGoal] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeIteration, setActiveIteration] = useState<number | null>(null)

  // Abort in-flight stream on unmount.
  useEffect(() => () => reset(), [reset])

  const canGenerate =
    goal.trim().length >= 3 && state.status !== 'generating' && state.status !== 'starting'

  const completedIterations = state.iterations.filter((it) => !it.validationFailed)
  const displayedIteration =
    activeIteration !== null
      ? completedIterations.find((it) => it.version === activeIteration)
      : completedIterations[completedIterations.length - 1]

  const latestCompleted = completedIterations[completedIterations.length - 1]
  const displayedArtifact =
    displayedIteration?.artifact ??
    (displayedIteration && latestCompleted && displayedIteration.version === latestCompleted.version
      ? state.bestArtifact
      : null) ??
    state.bestArtifact

  const scoreHistory = useMemo(
    () =>
      completedIterations.map((it) => ({
        iteration: `v${it.version}`,
        score: Number(it.score.toFixed(2)),
      })),
    [completedIterations]
  )

  const latestDims = displayedIteration?.dimensionScores ?? []
  const radarData = useMemo(
    () => latestDims.map((d) => ({ dim: d.name, score: d.score })),
    [latestDims]
  )

  const progress =
    state.maxIterations > 0
      ? Math.min(100, (state.currentIteration / state.maxIterations) * 100)
      : 0

  const statusLabel: Record<string, string> = {
    idle: 'Ready',
    starting: 'Starting…',
    generating: 'Generating',
    presenting: 'Ready for review',
    approved: 'Approved',
    rejected: 'Rejected',
    error: 'Error',
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Text Generation</h1>
          <p className="text-sm text-muted-foreground">
            Enter a topic. Watch the loop run. Review the result.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total cost</div>
          <div className="text-lg font-mono">${state.totalCostUSD.toFixed(4)}</div>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Write a 500-word intro to vector databases for web devs"
            disabled={state.status === 'generating' || state.status === 'starting'}
          />
          <div className="flex gap-2">
            <Button onClick={() => generate(goal)} disabled={!canGenerate}>
              Generate
            </Button>
            {(state.status === 'generating' || state.status === 'starting') && (
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            )}
            {state.status !== 'idle' && (
              <Button variant="outline" onClick={reset}>
                New session
              </Button>
            )}
            <div className="flex-1" />
            <Badge variant="secondary">{statusLabel[state.status] ?? state.status}</Badge>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {state.error}
          </CardContent>
        </Card>
      )}

      {state.status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                {(state.status === 'generating' || state.status === 'starting') && (
                  <span
                    aria-label="working"
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  />
                )}
                Iteration {state.currentIteration} / {state.maxIterations}
              </span>
              <span className="text-muted-foreground">
                {completedIterations.length} complete
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
              {(state.status === 'generating' || state.status === 'starting') && (
                <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {completedIterations.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold mb-4">
                {(state.bestScore ?? displayedIteration?.score ?? 0).toFixed(2)}
                <span className="text-lg text-muted-foreground">/10</span>
              </div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <LineChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="iteration" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimensions</CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length >= 3 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dim" />
                      <PolarRadiusAxis domain={[0, 10]} />
                      <Radar
                        dataKey="score"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.4}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ul className="space-y-2">
                  {latestDims.map((d) => (
                    <li key={d.dimensionId} className="flex justify-between text-sm">
                      <span>{d.name}</span>
                      <span className="font-mono">{d.score.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {completedIterations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Iterations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {completedIterations.map((it) => (
                <IterationChip
                  key={it.version}
                  it={it}
                  active={
                    (activeIteration ?? completedIterations[completedIterations.length - 1]?.version) ===
                    it.version
                  }
                  onClick={() => setActiveIteration(it.version)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {displayedArtifact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Article{' '}
              {displayedIteration && (
                <span className="text-xs text-muted-foreground">
                  v{displayedIteration.version} · {displayedIteration.score.toFixed(2)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownArticle source={displayedArtifact} />
          </CardContent>
        </Card>
      )}

      {state.status === 'presenting' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => submitReview('approve')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedback((v) => !v)}
                className="border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                Give feedback
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Discard this and start fresh?')) submitReview('reject')
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
                  placeholder="What should change?"
                  rows={3}
                />
                <Button
                  onClick={() => {
                    submitReview('feedback', feedback)
                    setFeedback('')
                    setShowFeedback(false)
                  }}
                  disabled={feedback.trim().length === 0}
                >
                  Submit feedback
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {state.status === 'approved' && (
        <Card className="border-green-600">
          <CardContent className="pt-6 text-green-700 font-medium">
            Approved and locked. Total cost: ${state.totalCostUSD.toFixed(4)}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const MarkdownArticle = memo(function MarkdownArticle({ source }: { source: string }) {
  return (
    <article className="max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          h1: (props) => <h1 className="text-2xl font-bold mt-6 mb-3" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold mt-6 mb-2" {...props} />,
          h3: (props) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
          h4: (props) => <h4 className="text-base font-semibold mt-3 mb-1" {...props} />,
          p: (props) => <p className="my-3" {...props} />,
          ul: (props) => <ul className="my-3 ml-6 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="my-3 ml-6 list-decimal space-y-1" {...props} />,
          li: (props) => <li className="pl-1" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          a: (props) => <a className="text-primary underline underline-offset-2" {...props} />,
          code: (props) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props} />
          ),
          pre: (props) => (
            <pre className="my-3 overflow-x-auto rounded bg-muted p-3 text-xs" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="my-3 border-l-2 border-border pl-4 italic text-muted-foreground" {...props} />
          ),
          hr: () => <hr className="my-6 border-border" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </article>
  )
})

function IterationChip({
  it,
  active,
  onClick,
}: {
  it: IterationSummary
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1 text-xs transition-colors ${
        active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
      }`}
    >
      v{it.version} · {it.score.toFixed(2)}
    </button>
  )
}
