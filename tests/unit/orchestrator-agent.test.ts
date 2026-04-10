import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  Challenge,
  OrchestratorOutput,
  IdeationMessageType,
} from '../../src/lib/domain/workflows/types'
import {
  clearAgents,
  getAgent,
  listAgents,
} from '../../src/lib/domain/workflows/agents/framework/registry'

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MOCK_AUDIENCE_PROFILE: AudienceProfile = {
  primaryAudience: {
    description: 'Mid-career CBSE teachers with 5-15 years of classroom experience.',
    ageRange: '30-50',
    educationLevel: "Bachelor's in Education (B.Ed.)",
    professionalRole: 'Mid-career CBSE teachers',
    experienceLevel: 'Intermediate — 5-15 years in teaching',
    learningContext: 'Self-paced online with optional mentor support',
    motivations: ['Improve instructional design skills', 'Meet professional development requirements'],
    painPoints: ['Limited time for PD', 'Previous training too theoretical'],
    technologyComfort: 'intermediate',
  },
  prerequisiteKnowledge: ['Basic teaching experience', 'Familiarity with CBSE curriculum'],
  learningPreferences: {
    preferredModalities: ['video', 'guided practice', 'case studies'],
    attentionSpan: 'medium',
    practicePreference: 'guided',
  },
}

const MOCK_PROPOSED_STRUCTURE: ProposedStructure = {
  courseTitle: 'Instructional Design Mastery for CBSE Educators',
  courseDescription: 'A 40-hour experiential program.',
  modules: [
    {
      title: 'Foundations of Instructional Design',
      description: 'Core ID principles',
      topics: [
        {
          title: 'What is Instructional Design?',
          description: 'Overview of ID models',
          keyConcepts: ['ADDIE', 'SAM', 'backward design'],
          estimatedMinutes: 90,
          difficulty: 'beginner',
          bloomLevel: 'understand',
        },
      ],
    },
  ],
  sequencingRationale: 'Theory first, then application.',
  alternativeStructures: [],
  confidenceScore: 0.85,
}

// ─── 3-Turn Conversation Mock Outputs ────────────────────────────────────

/** Turn 1: Human provides initial brief → orchestrator detects archetype, advances to structure */
const TURN_1_OUTPUT: OrchestratorOutput = {
  phaseAction: 'advance_phase',
  nextPhase: 'structure',
  agentsToRun: ['audience-analyst', 'curriculum-strategist'],
  humanFacingMessage: "Great brief! I'm detecting this as a **Professional Training** program. I'm now running two specialist agents: the Audience Analyst will profile your target learners (mid-career teachers), and the Curriculum Strategist will design a modular course structure for your 40-hour program. This will take a moment.",
  structuredProposal: { detectedArchetype: 'professional_training' },
}

/** Turn 2: Human provides more details → orchestrator continues gathering, requests confirmation */
const TURN_2_OUTPUT: OrchestratorOutput = {
  phaseAction: 'request_human_input',
  agentsToRun: [],
  humanFacingMessage: "Based on your input, here's what my agents have designed:\n\n**Audience:** Mid-career CBSE teachers (5-15 years), self-paced with optional mentor support.\n\n**Structure:** 5 modules covering ID foundations, learning outcomes, engagement strategies, assessment design, and a capstone project. Each module is ~8 hours with 3-4 topics.\n\nThe structure follows a theory-to-practice progression — foundational concepts first, then practical application, ending with a capstone where teachers design their own instructional plan.\n\nDoes this structure align with your vision? I can proceed to assign learning outcomes and recommended components (videos, study materials, quizzes, activities) to each module.",
  structuredProposal: { moduleCount: 5, totalHours: 40, hasCapstone: true },
}

/** Turn 3: Human approves → orchestrator advances to refinement, runs full agent suite */
const TURN_3_OUTPUT: OrchestratorOutput = {
  phaseAction: 'advance_phase',
  nextPhase: 'refinement',
  agentsToRun: ['outcome-architect', 'component-recommender', 'structure-optimizer', 'devils-advocate'],
  humanFacingMessage: "Excellent! Moving to the refinement phase. I'm now running four agents in parallel:\n\n1. **Outcome Architect** — mapping measurable learning outcomes to each module and topic\n2. **Component Recommender** — selecting the right mix of videos, study materials, quizzes, and activities for each node\n3. **Structure Optimizer** — checking for balance, gaps, and sequencing issues\n4. **Devil's Advocate** — stress-testing assumptions about your audience and design\n\nOnce they complete, I'll grade the full blueprint and present it for your review.",
}

// ─── Test Suite: Orchestrator Agent ──────────────────────────────────────

describe('Orchestrator Agent', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    clearAgents()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  async function getModule() {
    const executor = await import('../../src/lib/domain/workflows/agents/framework/executor')
    executor.resetClient()
    const mod = await import('../../src/lib/domain/workflows/agents/orchestrator')
    return mod
  }

  // ─── Registration ───────────────────────────────────────────────────────

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('orchestrator')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Orchestrator')
    expect(agent!.tier).toBe('orchestrator')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  // ─── Turn 1: Initial brief → detect archetype, advance to structure ───

  it('Turn 1: advances from brainstorm to structure on clear brief', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_1_OUTPUT) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    })

    const { runOrchestrator } = await getModule()
    const result = await runOrchestrator({
      humanMessage: 'I need to build a teacher training course on instructional design',
      currentPhase: 'brainstorm',
      context: {
        brief: 'I need to build a teacher training course on instructional design',
        conversationHistory: [],
      },
    })

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('orchestrator')
    expect(result.output).toBeDefined()
    expect(result.output!.phaseAction).toBe('advance_phase')
    expect(result.output!.nextPhase).toBe('structure')
    expect(result.output!.agentsToRun).toContain('audience-analyst')
    expect(result.output!.agentsToRun).toContain('curriculum-strategist')
    expect(result.output!.humanFacingMessage.length).toBeGreaterThan(0)
  })

  // ─── Turn 2: More details → request confirmation ──────────────────────

  it('Turn 2: requests human input to confirm structure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_2_OUTPUT) }],
      usage: { input_tokens: 1500, output_tokens: 600 },
    })

    const history: IdeationMessageType[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'human',
        messageType: 'text',
        content: 'I need to build a teacher training course on instructional design',
        createdAt: new Date('2026-03-29T10:00:00Z'),
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'facilitator',
        messageType: 'decision',
        content: 'Detected archetype: professional_training. Running audience-analyst and curriculum-strategist.',
        createdAt: new Date('2026-03-29T10:00:05Z'),
      },
    ]

    const { runOrchestrator } = await getModule()
    const result = await runOrchestrator({
      humanMessage: 'About 40 hours, self-paced, for mid-career teachers',
      currentPhase: 'structure',
      context: {
        brief: 'I need to build a teacher training course on instructional design',
        archetype: 'professional_training',
        audienceProfile: MOCK_AUDIENCE_PROFILE,
        proposedStructure: MOCK_PROPOSED_STRUCTURE,
        conversationHistory: history,
      },
    })

    expect(result.success).toBe(true)
    expect(result.output!.phaseAction).toBe('request_human_input')
    expect(result.output!.agentsToRun).toEqual([])
    expect(result.output!.humanFacingMessage).toContain('structure')
  })

  // ─── Turn 3: Human approves → advance to refinement ───────────────────

  it('Turn 3: advances to refinement when human confirms structure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_3_OUTPUT) }],
      usage: { input_tokens: 2000, output_tokens: 500 },
    })

    const history: IdeationMessageType[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'human',
        messageType: 'text',
        content: 'I need to build a teacher training course on instructional design',
        createdAt: new Date('2026-03-29T10:00:00Z'),
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'facilitator',
        messageType: 'decision',
        content: 'Detected archetype: professional_training.',
        createdAt: new Date('2026-03-29T10:00:05Z'),
      },
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        role: 'human',
        messageType: 'text',
        content: 'About 40 hours, self-paced, for mid-career teachers',
        createdAt: new Date('2026-03-29T10:01:00Z'),
      },
      {
        id: 'msg-4',
        conversationId: 'conv-1',
        role: 'facilitator',
        messageType: 'suggestion',
        content: 'Structure proposal: 5 modules, 40 hours, theory-to-practice progression.',
        createdAt: new Date('2026-03-29T10:01:10Z'),
      },
    ]

    const { runOrchestrator } = await getModule()
    const result = await runOrchestrator({
      humanMessage: 'Yes, proceed with that structure',
      currentPhase: 'structure',
      context: {
        brief: 'I need to build a teacher training course on instructional design',
        archetype: 'professional_training',
        audienceProfile: MOCK_AUDIENCE_PROFILE,
        proposedStructure: MOCK_PROPOSED_STRUCTURE,
        conversationHistory: history,
      },
    })

    expect(result.success).toBe(true)
    expect(result.output!.phaseAction).toBe('advance_phase')
    expect(result.output!.nextPhase).toBe('refinement')
    expect(result.output!.agentsToRun).toContain('outcome-architect')
    expect(result.output!.agentsToRun).toContain('component-recommender')
    expect(result.output!.agentsToRun).toContain('structure-optimizer')
    expect(result.output!.agentsToRun).toContain('devils-advocate')
    expect(result.output!.humanFacingMessage.length).toBeGreaterThan(0)
  })

  // ─── Prompt Includes Context ──────────────────────────────────────────

  it('includes current phase, message, and context in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_1_OUTPUT) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    })

    const { runOrchestrator } = await getModule()
    await runOrchestrator({
      humanMessage: 'Build a teacher training course',
      currentPhase: 'brainstorm',
      context: {
        brief: 'Teacher training on instructional design',
        conversationHistory: [],
      },
    })

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Current Phase: brainstorm')
    expect(userMsg).toContain('Build a teacher training course')
    expect(userMsg).toContain('Teacher training on instructional design')
  })

  it('includes conversation history in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_2_OUTPUT) }],
      usage: { input_tokens: 1000, output_tokens: 400 },
    })

    const history: IdeationMessageType[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'human',
        messageType: 'text',
        content: 'I want to build a training program',
        createdAt: new Date('2026-03-29T10:00:00Z'),
      },
    ]

    const { runOrchestrator } = await getModule()
    await runOrchestrator({
      humanMessage: '40 hours, self-paced',
      currentPhase: 'structure',
      context: {
        brief: 'Training program',
        conversationHistory: history,
      },
    })

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Conversation History')
    expect(userMsg).toContain('[Human]: I want to build a training program')
  })

  // ─── Cost Tracking ────────────────────────────────────────────────────

  it('tracks cost for every call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(TURN_1_OUTPUT) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    })

    const { runOrchestrator } = await getModule()
    const result = await runOrchestrator({
      humanMessage: 'Build a course',
      currentPhase: 'brainstorm',
      context: { conversationHistory: [] },
    })

    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.tokensIn).toBe(800)
    expect(result.tokensOut).toBe(400)
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  // ─── Error Handling ───────────────────────────────────────────────────

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('Service unavailable'))

    const { runOrchestrator } = await getModule()
    const result = await runOrchestrator({
      humanMessage: 'Build a course',
      currentPhase: 'brainstorm',
      context: { conversationHistory: [] },
    })

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// ─── Test Suite: All 8 Agents Registered ────────────────────────────────

describe('Agent Registry — All 8 Agents', () => {
  beforeEach(() => {
    // Reset module cache so self-registration side effects re-execute
    vi.resetModules()
  })

  async function importAllAgents() {
    // Fresh imports after resetModules — each triggers registerAgent()
    const { clearAgents: clear } = await import(
      '../../src/lib/domain/workflows/agents/framework/registry'
    )
    clear()
    await Promise.all([
      import('../../src/lib/domain/workflows/agents/audience-analyst'),
      import('../../src/lib/domain/workflows/agents/curriculum-strategist'),
      import('../../src/lib/domain/workflows/agents/outcome-architect'),
      import('../../src/lib/domain/workflows/agents/component-recommender'),
      import('../../src/lib/domain/workflows/agents/structure-optimizer'),
      import('../../src/lib/domain/workflows/agents/rubric-grader'),
      import('../../src/lib/domain/workflows/agents/devils-advocate'),
      import('../../src/lib/domain/workflows/agents/orchestrator'),
    ])
    const { listAgents: list, getAgent: get } = await import(
      '../../src/lib/domain/workflows/agents/framework/registry'
    )
    return { listAgents: list, getAgent: get }
  }

  it('has all 8 agents registered after importing all modules', async () => {
    const { listAgents: list } = await importAllAgents()

    const agents = list()
    const agentIds = agents.map(a => a.id).sort()

    expect(agents).toHaveLength(8)
    expect(agentIds).toEqual([
      'audience-analyst',
      'component-recommender',
      'curriculum-strategist',
      'devils-advocate',
      'orchestrator',
      'outcome-architect',
      'rubric-grader',
      'structure-optimizer',
    ])
  })

  it('each agent has valid tier assignment', async () => {
    const { listAgents: list } = await importAllAgents()

    const agents = list()

    // Production agents (Stage 0.2–0.3)
    const productionAgents = agents.filter(a => a.tier === 'production')
    expect(productionAgents.map(a => a.id).sort()).toEqual([
      'audience-analyst',
      'component-recommender',
      'curriculum-strategist',
      'outcome-architect',
    ])

    // Governance agents (Stage 0.4)
    const governanceAgents = agents.filter(a => a.tier === 'governance')
    expect(governanceAgents.map(a => a.id).sort()).toEqual([
      'devils-advocate',
      'rubric-grader',
      'structure-optimizer',
    ])

    // Orchestrator (spans all stages)
    const orchestratorAgents = agents.filter(a => a.tier === 'orchestrator')
    expect(orchestratorAgents).toHaveLength(1)
    expect(orchestratorAgents[0].id).toBe('orchestrator')
  })

  it('prints agent list from registry', async () => {
    const { listAgents: list } = await importAllAgents()

    const agents = list()
    const summary = agents.map(a => `  ${a.id} (${a.tier}) — ${a.name}`).sort()

    // This test prints the registry for verification
    expect(summary).toEqual([
      '  audience-analyst (production) — Audience Analyst',
      '  component-recommender (production) — Component Recommender',
      '  curriculum-strategist (production) — Curriculum Strategist',
      '  devils-advocate (governance) — Devil\'s Advocate',
      '  orchestrator (orchestrator) — Orchestrator',
      '  outcome-architect (production) — Outcome Architect',
      '  rubric-grader (governance) — Rubric Grader',
      '  structure-optimizer (governance) — Structure Optimizer',
    ])
  })
})
