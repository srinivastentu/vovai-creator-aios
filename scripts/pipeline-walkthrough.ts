// Pipeline Walkthrough — CLI tool for running the full 5-stage ideation pipeline
// Usage: npx tsx scripts/pipeline-walkthrough.ts [--interactive]

import * as readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { processReview } from '../src/lib/core/engine'
import type { LoopState } from '../src/lib/core/engine'
import {
  createElearnIdeationPipeline,
  ELEARN_IDEATION_STAGES,
} from '../src/lib/domain/workflows/ideation/pipeline-config'
import {
  runCurrentStage,
  getCurrentStage,
  canAdvance,
  advancePipeline,
  isPipelineComplete,
  getPipelineProgress,
} from '../src/lib/domain/workflows/pipeline-orchestrator'
import type { IdeationPipeline } from '../src/lib/domain/workflows/pipeline-orchestrator'
import { getExecutorAndJudge } from '../src/lib/domain/workflows/agents/agent-bridge'
import type { CostSnapshot } from '../src/lib/domain/workflows/agents/agent-bridge'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const isInteractive = process.argv.includes('--interactive')

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function printHeader(text: string) {
  const line = '━'.repeat(56)
  console.log(`\n${line}`)
  console.log(`  ${text}`)
  console.log(line)
}

function printProgress(completed: number, total: number) {
  const percent = Math.round((completed / total) * 100)
  const filled = Math.round(percent / 5)
  const empty = 20 - filled
  const bar = '▓'.repeat(filled) + '░'.repeat(empty)
  console.log(`\n  ${bar} ${percent}% (${completed}/${total} stages)\n`)
}

function truncateJson(obj: unknown, maxLines = 12): string {
  const full = JSON.stringify(obj, null, 2)
  const lines = full.split('\n')
  if (lines.length <= maxLines) return lines.map(l => `     ${l}`).join('\n')
  const truncated = lines.slice(0, maxLines).map(l => `     ${l}`).join('\n')
  return `${truncated}\n     ... (${lines.length - maxLines} more lines)`
}

function formatDimensionScores(grade: { dimensionScores: Array<{ name: string, score: number }> }): string {
  return grade.dimensionScores
    .map(d => `${d.name.toLowerCase()}: ${d.score}`)
    .join(' | ')
}

// ---------------------------------------------------------------------------
// Review gate — auto or interactive
// ---------------------------------------------------------------------------

async function handleReviewGate(
  pipeline: IdeationPipeline,
  stageId: string,
  rl: readline.Interface | null,
): Promise<{ pipeline: IdeationPipeline, action: 'approved' | 'loop' }> {
  const state = pipeline.stageStates[stageId]
  const score = state.bestGrade?.overallScore ?? 0
  const threshold = ELEARN_IDEATION_STAGES.find(s => s.id === stageId)?.threshold ?? 75

  // Transition presenting → awaiting_review
  const awaitingPipeline: IdeationPipeline = {
    ...pipeline,
    stageStates: {
      ...pipeline.stageStates,
      [stageId]: { ...state, status: 'awaiting_review' as const },
    },
  }

  console.log(`\n  🚪 Review gate — allowed actions: approve, reject, feedback`)

  if (!isInteractive || !rl) {
    // Auto-approve
    const approved = processReview(awaitingPipeline.stageStates[stageId], { type: 'approve' })
    const result: IdeationPipeline = {
      ...awaitingPipeline,
      stageStates: { ...awaitingPipeline.stageStates, [stageId]: approved },
    }
    console.log(`  ✅ Auto-approved — advancing to next stage`)
    return { pipeline: result, action: 'approved' }
  }

  // Interactive mode
  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log(`\n  🚪 Stage: ${stageId} — score ${score}/${threshold}`)
    console.log(`  [1] Approve  [2] Reject  [3] Feedback  [4] View full artifact`)
    const answer = (await rl.question('  > ')).trim()

    if (answer === '1') {
      const approved = processReview(awaitingPipeline.stageStates[stageId], { type: 'approve' })
      const result: IdeationPipeline = {
        ...awaitingPipeline,
        stageStates: { ...awaitingPipeline.stageStates, [stageId]: approved },
      }
      console.log(`  ✅ Approved — advancing to next stage`)
      return { pipeline: result, action: 'approved' }
    }

    if (answer === '2') {
      const rejected = processReview(awaitingPipeline.stageStates[stageId], { type: 'reject' })
      const result: IdeationPipeline = {
        ...awaitingPipeline,
        stageStates: { ...awaitingPipeline.stageStates, [stageId]: rejected },
      }
      console.log(`  🔄 Rejected — re-entering loop...`)
      return { pipeline: result, action: 'loop' }
    }

    if (answer === '3') {
      const msg = await rl.question('  Enter feedback: ')
      const withFeedback = processReview(awaitingPipeline.stageStates[stageId], {
        type: 'feedback',
        message: msg,
      })
      const result: IdeationPipeline = {
        ...awaitingPipeline,
        stageStates: { ...awaitingPipeline.stageStates, [stageId]: withFeedback },
      }
      console.log(`  📝 Feedback sent — re-entering loop...`)
      return { pipeline: result, action: 'loop' }
    }

    if (answer === '4') {
      console.log(`\n${JSON.stringify(awaitingPipeline.stageStates[stageId].bestArtifact, null, 2)}\n`)
      continue
    }

    console.log(`  Invalid choice. Enter 1, 2, 3, or 4.`)
  }
}

// ---------------------------------------------------------------------------
// Context accumulation — maps approved artifacts into PipelineContext shape
// ---------------------------------------------------------------------------

function updateContext(
  context: Record<string, unknown>,
  stageId: string,
  artifact: unknown,
) {
  switch (stageId) {
    case 'audience':
      context.audienceProfile = artifact
      break
    case 'structure':
      context.structure = artifact
      // Some structure agents also produce outcomesMap
      if (artifact && typeof artifact === 'object' && 'outcomesMap' in artifact) {
        context.outcomesMap = (artifact as Record<string, unknown>).outcomesMap
      }
      break
    case 'components':
      context.componentPlan = artifact
      break
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now()

  // Mode detection
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  const mode = hasApiKey ? '🤖 Mode: LIVE (real agents)' : '🔧 Mode: MOCK (no API key)'

  console.log('\n╔════════════════════════════════════════════════════════╗')
  console.log('║        VOVAI eLearn — Pipeline Walkthrough            ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log(`\n  ${mode}`)
  console.log(`  Interactive: ${isInteractive ? 'ON' : 'OFF (use --interactive to enable)'}`)

  // Setup
  const { agentExecutor, judge, getCostReport } = getExecutorAndJudge()
  let pipeline = createElearnIdeationPipeline('walkthrough-cli')

  const context: Record<string, unknown> = {
    brief: 'Build an AI fundamentals course for working professionals transitioning to AI roles. Cover ML basics, neural networks, and practical deployment. 8 hours total, no prerequisites beyond basic math.',
    archetype: 'professional_training',
  }

  const rl = isInteractive
    ? readline.createInterface({ input: stdin, output: stdout })
    : null

  const stageScores: Record<string, number> = {}
  let totalIterations = 0

  // Run all 5 stages
  for (let stageIdx = 0; stageIdx < pipeline.stages.length; stageIdx++) {
    const stageConfig = getCurrentStage(pipeline)
    if (!stageConfig) break

    const stageId = stageConfig.id
    const threshold = stageConfig.threshold
    const maxIter = stageConfig.maxIterations

    printHeader(`Stage ${stageIdx + 1}/5: ${stageId.toUpperCase()} (threshold: ${threshold}, max: ${maxIter} loops)`)

    // Loop until presenting (or max iterations exhausted)
    let stageComplete = false

    while (!stageComplete) {
      const state = pipeline.stageStates[stageId]

      // Guard: if already approved (shouldn't happen in normal flow)
      if (state.status === 'approved') break

      try {
        const result = await runCurrentStage(pipeline, context, agentExecutor, judge)
        pipeline = result.pipeline
        const stageState = result.stageState

        const score = stageState.bestGrade?.overallScore ?? 0
        const status = stageState.status
        const passMarker = status === 'presenting' ? ' ✓' : ''

        console.log(`  ⏳ Iteration ${stageState.loopCount}... score ${score}/${threshold} — ${status}${passMarker}`)

        totalIterations++

        if (status === 'presenting') {
          // Print artifact preview
          console.log(`\n  📋 Artifact preview:`)
          console.log(truncateJson(stageState.bestArtifact))

          // Print grade report
          const grade = stageState.bestGrade!
          const passLabel = grade.overallScore >= threshold ? 'PASS' : 'BELOW THRESHOLD'
          console.log(`\n  📊 Grade: ${grade.overallScore}/${threshold} (${passLabel})`)
          console.log(`     ${formatDimensionScores(grade)}`)

          // Review gate
          const reviewResult = await handleReviewGate(pipeline, stageId, rl)
          pipeline = reviewResult.pipeline

          if (reviewResult.action === 'approved') {
            stageScores[stageId] = grade.overallScore
            updateContext(context, stageId, stageState.bestArtifact)

            // Advance pipeline
            if (canAdvance(pipeline)) {
              pipeline = advancePipeline(pipeline)
            }
            stageComplete = true
          }
          // If action is 'loop', we continue the while loop (rejected/feedback)
        }

        // If status is 'revising', the while loop continues naturally

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  ❌ Error: ${msg}`)

        // If we have a best artifact, still allow review
        const currentState = pipeline.stageStates[stageId]
        if (currentState.bestArtifact) {
          console.log(`  ⚠️  Max iterations or error — presenting best artifact (score ${currentState.bestGrade?.overallScore ?? '?'})`)

          // Force to presenting so review gate works
          pipeline = {
            ...pipeline,
            stageStates: {
              ...pipeline.stageStates,
              [stageId]: { ...currentState, status: 'presenting' as const },
            },
          }

          const reviewResult = await handleReviewGate(pipeline, stageId, rl)
          pipeline = reviewResult.pipeline

          if (reviewResult.action === 'approved') {
            stageScores[stageId] = currentState.bestGrade?.overallScore ?? 0
            updateContext(context, stageId, currentState.bestArtifact)
            if (canAdvance(pipeline)) {
              pipeline = advancePipeline(pipeline)
            }
            stageComplete = true
          }
        } else {
          console.log(`  ❌ No artifact produced. Cannot continue.`)
          process.exit(1)
        }
      }
    }

    printProgress(stageIdx + 1, pipeline.stages.length)
  }

  // ---------------------------------------------------------------------------
  // Completion summary
  // ---------------------------------------------------------------------------

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  const cost = getCostReport()
  const costLabel = hasApiKey ? `$${cost.costUSD.toFixed(2)} (live)` : '$0.00 (mock)'
  const complete = isPipelineComplete(pipeline)
  const progress = getPipelineProgress(pipeline)

  console.log('━'.repeat(56))
  console.log(`  🎉 Pipeline ${complete ? 'complete' : 'incomplete'}!`)
  console.log('━'.repeat(56))
  console.log(`  Stages:      ${progress.completed}/${progress.total} approved`)
  console.log(`  Iterations:  ${totalIterations} total`)
  console.log(`  Best scores: ${Object.entries(stageScores).map(([k, v]) => `${k} ${v}`).join(' | ')}`)
  console.log(`  Cost:        ${costLabel}`)
  console.log(`  Duration:    ${duration}s`)
  console.log()

  if (rl) rl.close()
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error(`\n  ❌ Fatal error: ${err instanceof Error ? err.message : String(err)}`)
  if (String(err).includes('prisma') || String(err).includes('database')) {
    console.error('  Run: npx prisma migrate dev')
  }
  process.exit(1)
})
