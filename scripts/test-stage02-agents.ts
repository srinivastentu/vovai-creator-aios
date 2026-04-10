/**
 * Test Script — Stage 0.2 Agents (Audience Analyst + Curriculum Strategist)
 *
 * Runs both agents sequentially with a real brief:
 * 1. Audience Analyst produces an AudienceProfile
 * 2. Curriculum Strategist uses that profile to propose a structure
 *
 * Usage: npx tsx scripts/test-stage02-agents.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { runAudienceAnalyst } from '../src/lib/domain/workflows/agents/audience-analyst'
import { runCurriculumStrategist } from '../src/lib/domain/workflows/agents/curriculum-strategist'
import { listAgents } from '../src/lib/domain/workflows/agents/framework/registry'

const BRIEF = `I'm building a teacher retooling program on instructional design for mid-career CBSE teachers (5-15 years experience). About 40 hours total, self-paced with optional mentor support. Must be experiential and outcome-focused.`

const ARCHETYPE = 'professional_training' as const

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Stage 0.2 Agent Test — Audience Analyst + Curriculum Strategist')
  console.log('═══════════════════════════════════════════════════════════\n')

  // Show registered agents
  const agents = listAgents()
  console.log(`Registered agents: ${agents.map(a => a.id).join(', ')}\n`)

  // ── Step 1: Audience Analyst ────────────────────────────────────────────
  console.log('━━━ STEP 1: Audience Analyst ━━━\n')
  console.log(`Brief: "${BRIEF}"\n`)
  console.log(`Archetype: ${ARCHETYPE}\n`)

  const audienceResult = await runAudienceAnalyst(BRIEF, ARCHETYPE)

  if (!audienceResult.success || !audienceResult.output) {
    console.error('❌ Audience Analyst failed:', audienceResult.error)
    process.exit(1)
  }

  console.log('\n✅ Audience Profile:')
  console.log(JSON.stringify(audienceResult.output, null, 2))
  console.log(`\n📊 Cost: $${audienceResult.costUSD.toFixed(6)} | Model: ${audienceResult.modelUsed} | Duration: ${audienceResult.durationMs}ms`)
  console.log(`   Tokens: ${audienceResult.tokensIn} in / ${audienceResult.tokensOut} out\n`)

  // ── Step 2: Curriculum Strategist ───────────────────────────────────────
  console.log('━━━ STEP 2: Curriculum Strategist ━━━\n')

  const structureResult = await runCurriculumStrategist(
    BRIEF,
    ARCHETYPE,
    audienceResult.output,
    { totalHours: 40 }
  )

  if (!structureResult.success || !structureResult.output) {
    console.error('❌ Curriculum Strategist failed:', structureResult.error)
    process.exit(1)
  }

  const structure = structureResult.output

  console.log('\n✅ Proposed Structure:')
  console.log(`\n📖 ${structure.courseTitle}`)
  console.log(`   ${structure.courseDescription}\n`)

  for (const [i, mod] of structure.modules.entries()) {
    console.log(`  Module ${i + 1}: ${mod.title}`)
    console.log(`    ${mod.description}`)
    for (const [j, topic] of mod.topics.entries()) {
      const subtopicInfo = topic.subtopics?.length ? ` (${topic.subtopics.length} subtopics)` : ''
      console.log(`      ${i + 1}.${j + 1} ${topic.title} — ${topic.estimatedMinutes}min, ${topic.difficulty}, ${topic.bloomLevel}${subtopicInfo}`)
    }
  }

  console.log(`\n🧭 Sequencing Rationale:\n   ${structure.sequencingRationale}\n`)

  console.log('🔀 Alternative Structures:')
  for (const alt of structure.alternativeStructures) {
    console.log(`  • ${alt.title} (${alt.moduleCount} modules)`)
    console.log(`    ${alt.rationale}`)
    console.log(`    Tradeoffs: ${alt.tradeoffs}\n`)
  }

  console.log(`🎯 Confidence: ${(structure.confidenceScore * 100).toFixed(0)}%`)
  console.log(`\n📊 Cost: $${structureResult.costUSD.toFixed(6)} | Model: ${structureResult.modelUsed} | Duration: ${structureResult.durationMs}ms`)
  console.log(`   Tokens: ${structureResult.tokensIn} in / ${structureResult.tokensOut} out`)

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalCost = audienceResult.costUSD + structureResult.costUSD
  const totalDuration = audienceResult.durationMs + structureResult.durationMs
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  Total: $${totalCost.toFixed(6)} | ${(totalDuration / 1000).toFixed(1)}s`)
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
