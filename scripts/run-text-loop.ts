#!/usr/bin/env tsx
// Manual runner for the text generation loop.
// Usage: RUN_LIVE_TESTS=1 npx tsx scripts/run-text-loop.ts "your topic here"
//
// Requires: ANTHROPIC_API_KEY, OPENAI_API_KEY in the environment.

import { createTextGenerationStage } from '../src/lib/core/agentic/stages/text-generation-stage'
import { runTextLoop } from '../src/lib/core/agentic/stages/run-text-loop'

interface Snapshot {
  version: number
  byDim: Record<string, number>
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

  const tg = createTextGenerationStage({
    threshold: 7.5,
    minIterations: 2,
    maxIterations: 5,
  })

  const systemPrompt =
    'You are an expert educational writer. Produce a clear, engaging, accurate ' +
    'article (~400–600 words) for a curious general audience. Use concrete detail. ' +
    'End with a complete sentence.'

  const history: Snapshot[] = []

  console.log(`\n=== TEXT LOOP: ${topic} ===\n`)

  const result = await runTextLoop({
    stage: tg,
    context: { goal: topic, systemPrompt },
    onIteration: (e) => {
      if (e.validationFailed) {
        console.log(`v${e.version}: VALIDATION FAILED — regenerating.`)
        return
      }
      const byDim: Record<string, number> = {}
      for (const d of e.dimensionScores) byDim[d.dimensionId] = d.score
      const dims = e.dimensionScores
        .map((d) => `${d.dimensionId}=${d.score.toFixed(1)}`)
        .join(' ')
      console.log(`Iteration ${e.version}: score ${e.score.toFixed(2)} — ${dims}`)

      const prev = history[history.length - 1]
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
      history.push({ version: e.version, byDim })
    },
  })

  const bestIter =
    result.iterations.find(
      (i) => (i.grade?.overallScore ?? -1) === (result.bestScore ?? -2)
    ) ?? result.iterations[result.iterations.length - 1]

  console.log(
    `\nRESULT: Best version = v${bestIter?.version ?? '?'}, ` +
      `score = ${result.bestScore?.toFixed(2) ?? 'n/a'}, ` +
      `total cost = $${result.totalCostUSD.toFixed(4)}`
  )
  console.log(`Iterations: ${result.iterations.length}`)
  console.log('\n--- BEST ARTIFACT ---\n')
  console.log(result.bestArtifact ?? '(none)')
  console.log('\n--- END ---\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
