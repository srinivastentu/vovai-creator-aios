#!/usr/bin/env tsx
// Manual runner for the text generation loop.
// Usage: RUN_LIVE_TESTS=1 npx tsx scripts/run-text-loop.ts "your topic here"
//
// Requires: ANTHROPIC_API_KEY, OPENAI_API_KEY in the environment.
// Persists all versions + grades + summary to tmp/live-output/<ts>-<slug>/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createTextGenerationStage } from '../src/lib/core/agentic/stages/text-generation-stage'
import { runTextLoop } from '../src/lib/core/agentic/stages/run-text-loop'
import { DEFAULT_PROMPT_ADDONS } from '../src/lib/core/agentic/adapters/text-adapter'

interface Snapshot {
  version: number
  score: number
  byDim: Record<string, number>
  artifact: string
  validationFailed: boolean
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function tsStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

function diffHighlights(a: string, b: string): string[] {
  const pa = a.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const pb = b.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const notes: string[] = []
  notes.push(`Paragraph count: v-prev=${pa.length}, v-next=${pb.length}`)
  const wordsA = a.split(/\s+/).filter(Boolean).length
  const wordsB = b.split(/\s+/).filter(Boolean).length
  notes.push(`Word count: v-prev=${wordsA}, v-next=${wordsB} (Δ=${wordsB - wordsA})`)
  const setA = new Set(pa)
  const added = pb.filter((p) => !setA.has(p))
  const setB = new Set(pb)
  const removed = pa.filter((p) => !setB.has(p))
  notes.push(`Paragraphs added: ${added.length}, removed/rewritten: ${removed.length}`)
  if (added.length > 0) {
    notes.push('First new/changed paragraph (next version):')
    notes.push(`> ${added[0].slice(0, 240)}${added[0].length > 240 ? '…' : ''}`)
  }
  return notes
}

async function main() {
  const topic = process.argv.slice(2).join(' ').trim()
  if (!topic) {
    console.error('Usage: npx tsx scripts/run-text-loop.ts "<topic>"')
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('ANTHROPIC_API_KEY and OPENAI_API_KEY must be set.')
    process.exit(1)
  }

  const outDir = resolve(
    process.cwd(),
    'tmp',
    'live-output',
    `${tsStamp()}-${slugify(topic)}`
  )
  mkdirSync(outDir, { recursive: true })

  const tg = createTextGenerationStage({
    threshold: 7.5,
    minIterations: 2,
    maxIterations: 5,
    elevateThreshold: 8.0,
    costCeilingUSD: 0.1,
    factAudit: true,
  })

  const systemPrompt =
    'You are an expert educational writer. Produce a clear, engaging, accurate ' +
    'article for a curious general audience. Use concrete detail. End with a complete sentence.\n\n' +
    'Length should be proportional to the topic:\n' +
    '- Narrow, single-mechanism topics (how X works): ~400–600 words.\n' +
    '- Mid-scope topics (one concept with implications): ~600–900 words.\n' +
    '- Broad or multi-angle topics (history + impact; ethics; economics comparisons): ~900–1300 words.\n' +
    'Do not pad. Use specific data where you are confident it is accurate — round figures from reliable sources ("roughly 20%", "about 90% cost reduction") build credibility. Use hedging ("approximately", "studies suggest") where exact figures are uncertain. Do NOT avoid all numbers; vague language weakens the article. Do not fabricate false precision.' +
    DEFAULT_PROMPT_ADDONS

  const history: Snapshot[] = []

  console.log(`\n=== TEXT LOOP: ${topic} ===`)
  console.log(`Output: ${outDir}\n`)

  const result = await runTextLoop({
    stage: tg,
    context: { goal: topic, systemPrompt },
    onIteration: (e) => {
      if (e.validationFailed) {
        console.log(`v${e.version}: VALIDATION FAILED — regenerating.`)
        history.push({
          version: e.version,
          score: 0,
          byDim: {},
          artifact: e.artifact ?? '',
          validationFailed: true,
        })
        return
      }
      const byDim: Record<string, number> = {}
      for (const d of e.dimensionScores) byDim[d.dimensionId] = d.score
      const dims = e.dimensionScores
        .map((d) => `${d.dimensionId}=${d.score.toFixed(1)}`)
        .join(' ')
      console.log(`Iteration ${e.version}: score ${e.score.toFixed(2)} — ${dims}`)

      const prev = history.filter((h) => !h.validationFailed).pop()
      if (prev) {
        const preserved: string[] = []
        const improved: string[] = []
        const regressed: string[] = []
        for (const id of Object.keys(byDim)) {
          const now = byDim[id]
          const before = prev.byDim[id]
          if (before === undefined) continue
          if (before >= 8 && now >= 8) preserved.push(id)
          else if (now > before) improved.push(id)
          else if (now < before) regressed.push(id)
        }
        console.log(
          `  PRESERVE: [${preserved.join(', ') || '—'}]  ` +
            `IMPROVE: [${improved.join(', ') || '—'}]  ` +
            `REGRESS: [${regressed.join(', ') || '—'}]`
        )
      }

      history.push({
        version: e.version,
        score: e.score,
        byDim,
        artifact: e.artifact ?? '',
        validationFailed: false,
      })

      // Persist this version immediately so nothing is lost if a later iteration crashes.
      if (e.artifact) {
        writeFileSync(join(outDir, `v${e.version}.md`), e.artifact, 'utf8')
      }
    },
  })

  const judged = history.filter((h) => !h.validationFailed)
  const bestIter =
    result.iterations.find(
      (i) => (i.grade?.overallScore ?? -1) === (result.bestScore ?? -2)
    ) ?? result.iterations[result.iterations.length - 1]

  // grades.json
  const grades = {
    topic,
    threshold: 7.5,
    minIterations: 2,
    maxIterations: 5,
    finalStatus: result.finalState.status,
    totalCostUSD: result.totalCostUSD,
    bestVersion: bestIter?.version ?? null,
    bestScore: result.bestScore,
    iterations: judged.map((h) => ({
      version: h.version,
      composite: h.score,
      dimensions: h.byDim,
    })),
    validationFailures: history.filter((h) => h.validationFailed).map((h) => h.version),
    error: result.error ?? null,
  }
  writeFileSync(join(outDir, 'grades.json'), JSON.stringify(grades, null, 2), 'utf8')

  // summary.md
  const lines: string[] = []
  lines.push(`# Text loop run — ${topic}`)
  lines.push('')
  lines.push(`- Generated at: ${new Date().toISOString()}`)
  lines.push(`- Final status: \`${result.finalState.status}\``)
  lines.push(`- Iterations (judged): ${judged.length}`)
  lines.push(`- Total cost: $${result.totalCostUSD.toFixed(4)}`)
  lines.push(`- Best version: v${bestIter?.version ?? '?'} (score ${result.bestScore?.toFixed(2) ?? 'n/a'})`)
  if (result.error) lines.push(`- Error: ${result.error.message} (iter ${result.error.iteration})`)
  lines.push('')
  lines.push('## Per-iteration grades')
  lines.push('')
  for (let i = 0; i < judged.length; i++) {
    const h = judged[i]
    lines.push(`### v${h.version} — composite ${h.score.toFixed(2)}`)
    for (const [dim, sc] of Object.entries(h.byDim)) {
      lines.push(`- ${dim}: ${sc.toFixed(2)}`)
    }
    if (i > 0) {
      const prev = judged[i - 1]
      const preserved: string[] = []
      const improved: string[] = []
      const regressed: string[] = []
      for (const id of Object.keys(h.byDim)) {
        const before = prev.byDim[id]
        const now = h.byDim[id]
        if (before === undefined) continue
        if (before >= 8 && now >= 8) preserved.push(`${id}(${now.toFixed(1)})`)
        else if (now > before) improved.push(`${id}: ${before.toFixed(1)}→${now.toFixed(1)}`)
        else if (now < before) regressed.push(`${id}: ${before.toFixed(1)}→${now.toFixed(1)}`)
      }
      lines.push('')
      lines.push(`- PRESERVE: ${preserved.join(', ') || '—'}`)
      lines.push(`- IMPROVE: ${improved.join(', ') || '—'}`)
      lines.push(`- REGRESS: ${regressed.join(', ') || '—'}`)
    }
    lines.push('')
  }

  if (judged.length >= 2) {
    lines.push('## Diff highlights (v1 → final)')
    lines.push('')
    const notes = diffHighlights(judged[0].artifact, judged[judged.length - 1].artifact)
    for (const n of notes) lines.push(`- ${n}`)
    lines.push('')
  }

  lines.push('## Files')
  lines.push('')
  for (const h of judged) lines.push(`- [v${h.version}.md](./v${h.version}.md)`)
  lines.push('- [grades.json](./grades.json)')
  lines.push('')

  writeFileSync(join(outDir, 'summary.md'), lines.join('\n'), 'utf8')

  console.log(
    `\nRESULT: Best version = v${bestIter?.version ?? '?'}, ` +
      `score = ${result.bestScore?.toFixed(2) ?? 'n/a'}, ` +
      `total cost = $${result.totalCostUSD.toFixed(4)}`
  )
  console.log(`Wrote ${judged.length} version(s) + grades.json + summary.md`)
  console.log(`→ ${outDir}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
