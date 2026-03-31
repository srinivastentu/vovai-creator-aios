/**
 * E2E Test — Full Project Component Flow
 *
 * Runs the COMPLETE flow for an AI in Agrientrepreneurship project:
 * Create project → Create blueprint → Ideation (brainstorm → structure → grade → approve)
 * → Verify tree → Create version → Handoff → Verify final state
 *
 * NOTE: This test calls REAL APIs (Anthropic) and costs real money (~$0.30-0.60).
 * Run manually, NOT in CI.
 *
 * Usage: npm run test:e2e
 *    or: npx tsx scripts/test-e2e-project-component.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const TIMEOUT_MS = 300_000 // 5 min per request (LLM + structure generation can be slow)

const BRIEF = `Build a professional training course on AI in Agrientrepreneurship for aspiring rural entrepreneurs and agriculture graduates. 3 modules covering: (1) Foundations of AI and Agriculture Tech, (2) AI-Powered Farming and Supply Chain, (3) Building an Agri-Tech Startup. Each module should have 2-3 topics with subtopics. Include study materials, videos, quizzes, activities, and a capstone project. About 30 hours total, self-paced, practical and hands-on focused. Target audience has basic tech literacy but deep agriculture domain knowledge.`

const FOLLOW_UP_MESSAGES = [
  'The audience is agriculture graduates and aspiring rural entrepreneurs in India. They have deep domain knowledge in farming and agriculture but basic tech literacy. They prefer practical, hands-on approaches with real-world case studies from Indian agriculture.',
  'Focus on 3 core modules: (1) Foundations of AI and Agriculture Tech, (2) AI-Powered Farming and Supply Chain, (3) Building an Agri-Tech Startup. Each module should have 2-3 topics with study materials, videos, quizzes, and hands-on activities. Include a capstone project.',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface StepResult {
  step: string
  passed: boolean
  durationMs: number
  details: string
  data?: Record<string, unknown>
}

const results: StepResult[] = []
let totalCostUSD = 0
let totalMessages = 0

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const url = `${BASE_URL}${path}`
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const data = await res.json() as Record<string, unknown>
  return { status: res.status, data }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

async function runStep(
  name: string,
  fn: () => Promise<{ details: string; data?: Record<string, unknown> }>
): Promise<void> {
  const start = Date.now()
  try {
    const result = await fn()
    results.push({
      step: name,
      passed: true,
      durationMs: Date.now() - start,
      details: result.details,
      data: result.data,
    })
    console.log(`  PASS  ${name} (${Date.now() - start}ms)`)
    console.log(`        ${result.details}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({
      step: name,
      passed: false,
      durationMs: Date.now() - start,
      details: msg,
    })
    console.log(`  FAIL  ${name} (${Date.now() - start}ms)`)
    console.log(`        ${msg}`)
    throw err // stop the run
  }
}

// ─── State (populated across steps) ─────────────────────────────────────────

let projectId = ''
let blueprintId = ''
let gradeScore = 0
let totalJobs = 0

// ─── Steps ───────────────────────────────────────────────────────────────────

async function step1_createProject() {
  return runStep('Step 1: Create project', async () => {
    const { status, data } = await api('POST', '/api/projects', {
      name: 'E2E Test: AI in Agrientrepreneurship',
      topic: 'AI in Agriculture & Rural Entrepreneurship',
      targetAudience: 'Agriculture graduates and rural entrepreneurs',
      durationMinutes: 1800,
    })
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(typeof data.id === 'string', 'Missing project id')
    projectId = data.id as string
    return { details: `Project created: ${projectId}`, data }
  })
}

async function step2_createBlueprint() {
  return runStep('Step 2: Create blueprint', async () => {
    const { status, data } = await api('POST', '/api/blueprints', {
      projectId,
      archetype: 'professional_training',
    })
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(typeof data.id === 'string', 'Missing blueprint id')
    blueprintId = data.id as string
    return {
      details: `Blueprint created: ${blueprintId}, archetype: ${data.archetype}`,
      data,
    }
  })
}

async function step3_startIdeation() {
  return runStep('Step 3: Start ideation', async () => {
    const { status, data } = await api(
      'POST',
      `/api/blueprints/${blueprintId}/ideation/start`,
      { brief: BRIEF }
    )
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(typeof data.conversationId === 'string', 'Missing conversationId')
    assert(typeof data.message === 'string', 'Missing agent message')

    const cost = (data.costUSD as number) || 0
    totalCostUSD += cost
    totalMessages += 1 // human brief + 1 agent response

    return {
      details: `Conversation started. Phase: ${data.phase}, cost: $${cost.toFixed(4)}`,
      data,
    }
  })
}

async function step4_sendFollowUps() {
  return runStep('Step 4: Send follow-up messages & advance to structure', async () => {
    // Send the prepared follow-up messages
    let lastPhase = ''
    for (let i = 0; i < FOLLOW_UP_MESSAGES.length; i++) {
      const msg = FOLLOW_UP_MESSAGES[i]
      console.log(`        Sending message ${i + 1}/${FOLLOW_UP_MESSAGES.length}...`)

      const { status, data } = await api(
        'POST',
        `/api/blueprints/${blueprintId}/ideation/message`,
        { message: msg }
      )
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
      assert(typeof data.message === 'string', 'Missing agent response')

      const cost = (data.costUSD as number) || 0
      totalCostUSD += cost
      totalMessages += 2 // human + agent
      lastPhase = data.phase as string
      console.log(`        Phase: ${lastPhase}, cost: $${cost.toFixed(4)}`)

      // If we've already left brainstorm, no need for more follow-ups
      if (lastPhase !== 'brainstorm') break
    }

    // If still in brainstorm after prepared messages, keep nudging until
    // the orchestrator advances (up to 3 more attempts)
    const ADVANCE_NUDGES = [
      'I have provided all the details. Please proceed to create the full project structure with modules, topics, and components.',
      'Yes, lets move forward. Build the course hierarchy now — 3 modules with topics, subtopics, study materials, videos, quizzes, activities, and a capstone project.',
      'Confirmed. Create the structure now.',
    ]

    let nudgeCount = 0
    while (lastPhase === 'brainstorm' && nudgeCount < ADVANCE_NUDGES.length) {
      const nudge = ADVANCE_NUDGES[nudgeCount]
      nudgeCount++
      console.log(`        Still in brainstorm — sending advance nudge ${nudgeCount}/${ADVANCE_NUDGES.length}...`)

      const { status, data } = await api(
        'POST',
        `/api/blueprints/${blueprintId}/ideation/message`,
        { message: nudge }
      )
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
      totalCostUSD += (data.costUSD as number) || 0
      totalMessages += 2
      lastPhase = data.phase as string
      console.log(`        Phase: ${lastPhase}`)
    }

    assert(
      lastPhase !== 'brainstorm',
      `Stuck in brainstorm phase after ${FOLLOW_UP_MESSAGES.length + nudgeCount} messages. Orchestrator won't advance.`
    )

    return {
      details: `Messages sent. Phase: ${lastPhase}. Total messages: ${totalMessages}`,
    }
  })
}

async function step5_getGrade() {
  return runStep('Step 5: Verify/trigger grading', async () => {
    const { data: bpData } = await api('GET', `/api/blueprints/${blueprintId}`)
    let currentPhase = bpData.ideationPhase as string
    console.log(`        Current phase: ${currentPhase}`)

    // ── Fast path: already in review or approved (grading happened in the loop) ──
    if (currentPhase === 'review' || currentPhase === 'approved') {
      console.log('        Fast path: already past grading. Fetching existing grade...')
      const { status: gradeStatus, data: gradeData } = await api(
        'GET',
        `/api/blueprints/${blueprintId}/grades`
      )
      if (gradeStatus === 200 && gradeData && (gradeData as Record<string, unknown>).overallScore != null) {
        gradeScore = (gradeData as Record<string, unknown>).overallScore as number
      }
      return {
        details: `Grade exists (fast path). Score: ${gradeScore}, phase: ${currentPhase}`,
      }
    }

    // ── Slow path: trigger grading if in structure or refinement ──
    // The grade endpoint processes one refinement cycle at a time.
    // Keep calling until we reach review (score >= 75 or max 5 loops).
    const MAX_GRADE_CALLS = 6
    let gradeCalls = 0

    while (
      (currentPhase === 'structure' || currentPhase === 'refinement') &&
      gradeCalls < MAX_GRADE_CALLS
    ) {
      gradeCalls++
      console.log(`        Triggering grade (call ${gradeCalls}/${MAX_GRADE_CALLS}, phase: ${currentPhase})...`)

      const { status, data } = await api(
        'POST',
        `/api/blueprints/${blueprintId}/ideation/grade`,
        {}
      )

      if (status !== 200) {
        console.log(`        Grade returned ${status}: ${JSON.stringify(data)}`)
        break
      }

      totalCostUSD += (data.costUSD as number) || 0
      currentPhase = data.phase as string

      const report = data.gradeReport as Record<string, unknown> | null
      const score = (report?.overallScore as number) || 0
      if (score > gradeScore) gradeScore = score
      console.log(`        Phase: ${currentPhase}, score: ${score}`)
    }

    // Verify we got somewhere useful
    const validPhases = ['refinement', 'review', 'approved']
    assert(
      validPhases.includes(currentPhase),
      `Unexpected phase after ${gradeCalls} grade calls: '${currentPhase}'`
    )

    return {
      details: `Grading complete after ${gradeCalls} calls. Score: ${gradeScore}, phase: ${currentPhase}`,
    }
  })
}

async function step6_approveStructure() {
  return runStep('Step 6: Approve structure', async () => {
    const { data: bpData } = await api('GET', `/api/blueprints/${blueprintId}`)
    let currentPhase = bpData.ideationPhase as string
    console.log(`        Phase before approve: ${currentPhase}`)

    // If already approved (shouldn't happen, but handle gracefully)
    if (currentPhase === 'approved') {
      return { details: 'Structure already approved (no-op).' }
    }

    // If still in structure/refinement, trigger grade cycles until review.
    // Engine auto-routes: score >= 75 → review. Max 5 loops → forced review.
    const MAX_GRADE_ATTEMPTS = 6
    let gradeAttempts = 0
    while (
      (currentPhase === 'structure' || currentPhase === 'refinement') &&
      gradeAttempts < MAX_GRADE_ATTEMPTS
    ) {
      gradeAttempts++
      console.log(`        Phase is '${currentPhase}' — triggering grade (attempt ${gradeAttempts}/${MAX_GRADE_ATTEMPTS})...`)
      const { status: gradeStatus, data: gradeData } = await api(
        'POST',
        `/api/blueprints/${blueprintId}/ideation/grade`,
        {}
      )
      if (gradeStatus !== 200) {
        console.log(`        Grade returned ${gradeStatus}: ${JSON.stringify(gradeData)}`)
        const { data: check } = await api('GET', `/api/blueprints/${blueprintId}`)
        currentPhase = check.ideationPhase as string
        break
      }
      totalCostUSD += (gradeData.costUSD as number) || 0
      currentPhase = gradeData.phase as string

      const report = gradeData.gradeReport as Record<string, unknown> | null
      const score = (report?.overallScore as number) || 0
      if (score > gradeScore) gradeScore = score
      console.log(`        Phase after grade: ${currentPhase}, score: ${score}`)
    }

    // Final check
    if (currentPhase !== 'review') {
      const { data: finalCheck } = await api('GET', `/api/blueprints/${blueprintId}`)
      currentPhase = finalCheck.ideationPhase as string
      console.log(`        Final phase check: ${currentPhase}`)
    }

    assert(
      currentPhase === 'review',
      `Blueprint not in review phase after ${gradeAttempts} grade attempts (got '${currentPhase}'). Cannot approve.`
    )

    // Now approve
    const { status, data } = await api(
      'POST',
      `/api/blueprints/${blueprintId}/ideation/approve`,
      { action: 'approve' }
    )
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
    assert(data.phase === 'approved', `Expected phase 'approved', got '${data.phase}'`)

    totalCostUSD += (data.costUSD as number) || 0

    return {
      details: `Structure approved after ${gradeAttempts} grade cycles. Phase: ${data.phase}`,
      data,
    }
  })
}

async function step7_verifyTree() {
  return runStep('Step 7: Verify tree structure', async () => {
    const { status, data } = await api(
      'GET',
      `/api/blueprints/${blueprintId}/nodes`
    )
    assert(status === 200, `Expected 200, got ${status}`)

    const nodes = data as unknown as Array<Record<string, unknown>>
    assert(Array.isArray(nodes), 'Expected array of nodes')
    assert(nodes.length > 0, 'Expected at least one node')

    // Count by depth
    const depths: Record<number, number> = {}
    let componentCount = 0
    for (const node of nodes) {
      const d = node.depth as number
      depths[d] = (depths[d] || 0) + 1
      const comps = node.components as Array<unknown> | undefined
      if (comps) componentCount += comps.length
    }

    const depthSummary = Object.entries(depths)
      .map(([d, c]) => `depth ${d}: ${c}`)
      .join(', ')

    return {
      details: `${nodes.length} nodes (${depthSummary}), ${componentCount} components attached`,
    }
  })
}

async function step8_createVersion() {
  return runStep('Step 8: Create version snapshot', async () => {
    const { status, data } = await api(
      'POST',
      `/api/blueprints/${blueprintId}/versions`
    )
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)

    const version = data.version as number
    assert(version >= 1, `Expected version >= 1, got ${version}`)

    return {
      details: `Version ${version} created`,
      data,
    }
  })
}

async function step9_executeHandoff() {
  return runStep('Step 9: Execute handoff', async () => {
    const { status, data } = await api(
      'POST',
      '/api/project-component/handoff',
      { blueprintId }
    )
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)

    const result = data.data as Record<string, unknown>
    assert(result !== undefined, 'Missing data in handoff response')

    totalJobs = result.totalJobs as number
    const jobsByPhase = result.jobsByPhase as Record<string, number>
    const videoBatchCount = result.videoBatchCount as number
    const sessionIds = result.createdSessionIds as string[]
    const cost = result.estimatedCost as Record<string, unknown>

    assert(totalJobs > 0, `Expected > 0 jobs, got ${totalJobs}`)
    assert(sessionIds.length > 0, 'No session IDs created')

    const phaseBreakdown = Object.entries(jobsByPhase)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')

    return {
      details: `${totalJobs} jobs created (${phaseBreakdown}). Video batches: ${videoBatchCount}. Sessions: ${sessionIds.length}`,
      data: result as Record<string, unknown>,
    }
  })
}

async function step10_verifyFinalState() {
  return runStep('Step 10: Verify final state', async () => {
    const { status, data } = await api('GET', `/api/blueprints/${blueprintId}`)
    assert(status === 200, `Expected 200, got ${status}`)

    // Verify phase
    const phase = data.ideationPhase as string
    assert(phase === 'approved', `Expected 'approved', got '${phase}'`)

    // Verify nodes and components have pipeline jobs
    const { data: nodesData } = await api(
      'GET',
      `/api/blueprints/${blueprintId}/nodes`
    )
    const nodes = nodesData as unknown as Array<Record<string, unknown>>

    let queuedCount = 0
    let jobLinked = 0
    for (const node of nodes) {
      const comps = node.components as Array<Record<string, unknown>> | undefined
      if (!comps) continue
      for (const comp of comps) {
        if (comp.status === 'queued' || comp.status === 'configured' || comp.status === 'planned') {
          queuedCount++
        }
        if (comp.pipelineJobId) {
          jobLinked++
        }
      }
    }

    // Get project to verify cost tracking
    const { data: projects } = await api('GET', '/api/projects')
    const projectList = projects as unknown as Array<Record<string, unknown>>
    const project = projectList.find(p => p.id === projectId) as Record<string, unknown> | undefined

    return {
      details: `Phase: ${phase}. Components: ${queuedCount} queued/ready, ${jobLinked} linked to pipeline jobs. Project status: ${project?.status || 'unknown'}`,
    }
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('================================================================')
  console.log('  E2E Test — Full Project Component Flow')
  console.log('  Target: AI in Agrientrepreneurship')
  console.log(`  Server: ${BASE_URL}`)
  console.log('  WARNING: This test calls real LLM APIs and costs ~$0.30-0.60')
  console.log('================================================================\n')

  // Verify server is up
  try {
    const res = await fetch(`${BASE_URL}/api/project-component/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`Health check returned ${res.status}`)
    const health = await res.json()
    console.log(`  Server healthy: ${JSON.stringify(health)}\n`)
  } catch (err) {
    console.error(`\n  ERROR: Server not reachable at ${BASE_URL}`)
    console.error('  Make sure the dev server is running: npm run dev\n')
    process.exit(1)
  }

  const startTime = Date.now()

  try {
    await step1_createProject()
    await step2_createBlueprint()
    await step3_startIdeation()
    await step4_sendFollowUps()
    await step5_getGrade()
    await step6_approveStructure()
    await step7_verifyTree()
    await step8_createVersion()
    await step9_executeHandoff()
    await step10_verifyFinalState()
  } catch {
    // Error already logged by runStep
  }

  const totalMs = Date.now() - startTime
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\n================================================================')
  console.log('  E2E RESULTS')
  console.log('================================================================')
  console.log()

  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL'
    console.log(`  ${icon}  ${r.step} (${r.durationMs}ms)`)
  }

  console.log()
  console.log(`  ${passed} passed, ${failed} failed, ${results.length} total`)
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`  Total LLM cost: $${totalCostUSD.toFixed(4)}`)
  console.log(`  Total messages: ${totalMessages}`)
  console.log()

  if (failed === 0) {
    console.log(`  E2E PASS: Created project -> ideation (${totalMessages} messages, $${totalCostUSD.toFixed(4)} cost) -> grading (score: ${gradeScore}) -> approval -> handoff (${totalJobs} jobs created)`)
  } else {
    const firstFail = results.find(r => !r.passed)
    console.log(`  E2E FAIL: Stopped at "${firstFail?.step}": ${firstFail?.details}`)
  }

  console.log()

  // Cleanup hint
  if (projectId) {
    console.log(`  Cleanup: Project ID ${projectId} was created.`)
    console.log(`  You can delete it manually or it will be cleaned up by future test runs.\n`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
