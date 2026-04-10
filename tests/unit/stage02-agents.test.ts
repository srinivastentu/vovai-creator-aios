import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AudienceProfile } from '../../src/lib/domain/workflows/types'
import {
  clearAgents,
  getAgent,
  listAgents,
  registerAgent,
} from '../../src/lib/domain/workflows/agents/framework/registry'

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────

const BRIEF = `I'm building a teacher retooling program on instructional design for mid-career CBSE teachers (5-15 years experience). About 40 hours total, self-paced with optional mentor support. Must be experiential and outcome-focused.`

const MOCK_AUDIENCE_PROFILE: AudienceProfile = {
  primaryAudience: {
    description: 'Mid-career CBSE teachers with 5-15 years of classroom experience seeking to modernize their instructional design skills.',
    ageRange: '30-50',
    educationLevel: "Bachelor's in Education (B.Ed.)",
    professionalRole: 'Mid-career CBSE teachers',
    experienceLevel: 'Intermediate — 5-15 years in teaching',
    learningContext: 'Self-paced online with optional mentor support',
    motivations: [
      'Stay current with modern pedagogical practices',
      'Improve student outcomes through better course design',
      'Meet professional development requirements',
    ],
    painPoints: [
      'Limited time for professional development alongside teaching duties',
      'Previous training was too theoretical and not applicable',
      'Lack of hands-on practice in existing courses',
    ],
    technologyComfort: 'intermediate',
  },
  prerequisiteKnowledge: [
    'Basic teaching experience in a CBSE school',
    'Familiarity with CBSE curriculum structure',
    'Basic computer literacy',
  ],
  learningPreferences: {
    preferredModalities: ['video', 'guided practice', 'case studies', 'peer discussion'],
    attentionSpan: 'medium',
    practicePreference: 'guided',
  },
}

const MOCK_PROPOSED_STRUCTURE = {
  courseTitle: 'Instructional Design Mastery for CBSE Educators',
  courseDescription: 'A 40-hour experiential program that equips mid-career CBSE teachers with modern instructional design skills through hands-on practice and real classroom application.',
  modules: [
    {
      title: 'Foundations of Instructional Design',
      description: 'Core ID principles and frameworks',
      topics: [
        {
          title: 'What is Instructional Design?',
          description: 'Overview of ID models and their relevance to CBSE',
          keyConcepts: ['ADDIE', 'SAM', 'backward design'],
          estimatedMinutes: 90,
          subtopics: ['History of ID', 'ID in Indian education'],
          difficulty: 'beginner',
          bloomLevel: 'understand',
        },
        {
          title: 'Learning Outcomes & Alignment',
          description: 'Writing measurable learning outcomes',
          keyConcepts: ["Bloom's taxonomy", 'constructive alignment'],
          estimatedMinutes: 120,
          difficulty: 'intermediate',
          bloomLevel: 'apply',
        },
      ],
    },
    {
      title: 'Designing for Engagement',
      description: 'Strategies for active learning in CBSE classrooms',
      topics: [
        {
          title: 'Active Learning Strategies',
          description: 'Practical techniques for classroom engagement',
          keyConcepts: ['think-pair-share', 'jigsaw', 'flipped classroom'],
          estimatedMinutes: 90,
          difficulty: 'intermediate',
          bloomLevel: 'apply',
        },
      ],
    },
  ],
  sequencingRationale: 'Begins with foundational ID theory, then moves to practical application. Scaffolded from understanding to creating.',
  alternativeStructures: [
    {
      title: 'Problem-Based Approach',
      description: 'Organized around common teaching challenges',
      rationale: 'Teachers learn by solving real problems they face daily',
      moduleCount: 6,
      tradeoffs: 'More engaging but less systematic coverage of ID theory',
    },
    {
      title: 'Project-Based Approach',
      description: 'Each module produces a deliverable',
      rationale: 'Teachers build a complete course design portfolio',
      moduleCount: 5,
      tradeoffs: 'Highly practical but may rush theoretical foundations',
    },
  ],
  confidenceScore: 0.85,
}

// ─── Test Suite ───────────────────────────────────────────────────────────

describe('Audience Analyst Agent', () => {
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
    const mod = await import('../../src/lib/domain/workflows/agents/audience-analyst')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('audience-analyst')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Audience Analyst')
    expect(agent!.tier).toBe('production')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns AudienceProfile on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
      usage: { input_tokens: 500, output_tokens: 400 },
    })

    const { runAudienceAnalyst } = await getModule()
    const result = await runAudienceAnalyst(BRIEF, 'professional_training')

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('audience-analyst')
    expect(result.output).toBeDefined()
    expect(result.output!.primaryAudience.description).toContain('CBSE')
    expect(result.output!.primaryAudience.technologyComfort).toBe('intermediate')
    expect(result.output!.prerequisiteKnowledge.length).toBeGreaterThan(0)
    expect(result.output!.learningPreferences.preferredModalities.length).toBeGreaterThan(0)
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
      usage: { input_tokens: 500, output_tokens: 400 },
    })

    const { runAudienceAnalyst } = await getModule()
    const result = await runAudienceAnalyst(BRIEF, 'professional_training')

    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.tokensIn).toBe(500)
    expect(result.tokensOut).toBe(400)
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('includes archetype in the user message', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runAudienceAnalyst } = await getModule()
    await runAudienceAnalyst(BRIEF, 'k12_curriculum')

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('k12_curriculum')
    expect(callArgs.messages[0].content).toContain(BRIEF)
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runAudienceAnalyst } = await getModule()
    const result = await runAudienceAnalyst(BRIEF, 'professional_training')

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

describe('Curriculum Strategist Agent', () => {
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
    const mod = await import('../../src/lib/domain/workflows/agents/curriculum-strategist')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('curriculum-strategist')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Curriculum Strategist')
    expect(agent!.tier).toBe('production')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns ProposedStructure on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 800, output_tokens: 1200 },
    })

    const { runCurriculumStrategist } = await getModule()
    const result = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('curriculum-strategist')
    expect(result.output).toBeDefined()
    expect(result.output!.courseTitle).toBe('Instructional Design Mastery for CBSE Educators')
    expect(result.output!.modules.length).toBeGreaterThan(0)
    expect(result.output!.modules[0].topics.length).toBeGreaterThan(0)
    expect(result.output!.alternativeStructures.length).toBe(2)
    expect(result.output!.confidenceScore).toBe(0.85)
  })

  it('includes audience profile and archetype hierarchy in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runCurriculumStrategist } = await getModule()
    await runCurriculumStrategist(BRIEF, 'professional_training', MOCK_AUDIENCE_PROFILE)

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Professional Training Course')
    expect(userMsg).toContain('primaryAudience')
    expect(userMsg).toContain(BRIEF)
  })

  it('passes constraints when provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runCurriculumStrategist } = await getModule()
    await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE,
      { totalHours: 40, maxModules: 8, focusAreas: ['experiential learning'] }
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Total course hours: 40')
    expect(userMsg).toContain('Maximum modules: 8')
    expect(userMsg).toContain('experiential learning')
  })

  it('works without constraints', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runCurriculumStrategist } = await getModule()
    const result = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 800, output_tokens: 1200 },
    })

    const { runCurriculumStrategist } = await getModule()
    const result = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE
    )

    // sonnet: 800 * $3/MTok + 1200 * $15/MTok = $0.0024 + $0.018 = $0.0204
    expect(result.costUSD).toBeCloseTo(0.0204, 4)
    expect(result.tokensIn).toBe(800)
    expect(result.tokensOut).toBe(1200)
  })

  it('validates topic shape in response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runCurriculumStrategist } = await getModule()
    const result = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE
    )

    const topic = result.output!.modules[0].topics[0]
    expect(topic.title).toBeDefined()
    expect(topic.keyConcepts.length).toBeGreaterThan(0)
    expect(topic.estimatedMinutes).toBeGreaterThan(0)
    expect(['beginner', 'intermediate', 'advanced']).toContain(topic.difficulty)
    expect(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).toContain(topic.bloomLevel)
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runCurriculumStrategist } = await getModule()
    const result = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
  })
})

describe('Stage 0.2 Integration (mocked)', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  it('runs audience analyst → curriculum strategist pipeline', async () => {
    clearAgents()
    const executor = await import('../../src/lib/domain/workflows/agents/framework/executor')
    executor.resetClient()

    // Import agents (triggers self-registration)
    const { runAudienceAnalyst } = await import('../../src/lib/domain/workflows/agents/audience-analyst')
    const { runCurriculumStrategist } = await import('../../src/lib/domain/workflows/agents/curriculum-strategist')

    // Re-register since clearAgents removed them and modules are cached
    const { AUDIENCE_ANALYST_CONFIG } = await import('../../src/lib/domain/workflows/agents/audience-analyst')
    const { CURRICULUM_STRATEGIST_CONFIG } = await import('../../src/lib/domain/workflows/agents/curriculum-strategist')
    clearAgents()
    registerAgent(AUDIENCE_ANALYST_CONFIG)
    registerAgent(CURRICULUM_STRATEGIST_CONFIG)

    // First call = audience analyst
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
      usage: { input_tokens: 500, output_tokens: 400 },
    })
    // Second call = curriculum strategist
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
      usage: { input_tokens: 800, output_tokens: 1200 },
    })

    // Step 1: Audience Analyst
    const audienceResult = await runAudienceAnalyst(BRIEF, 'professional_training')
    expect(audienceResult.success).toBe(true)

    // Step 2: Curriculum Strategist uses audience output
    const structureResult = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      audienceResult.output!,
      { totalHours: 40 }
    )
    expect(structureResult.success).toBe(true)
    expect(structureResult.output!.modules.length).toBeGreaterThan(0)

    // Total cost tracked
    const totalCost = audienceResult.costUSD + structureResult.costUSD
    expect(totalCost).toBeGreaterThan(0)

    // Both agents registered
    expect(getAgent('audience-analyst')).toBeDefined()
    expect(getAgent('curriculum-strategist')).toBeDefined()
    expect(listAgents().length).toBeGreaterThanOrEqual(2)
  })
})
