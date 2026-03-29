import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AudienceProfile, OutcomesMap, ComponentPlan, ProposedStructure } from '../../src/lib/project-component/types'
import {
  clearAgents,
  getAgent,
  listAgents,
  registerAgent,
} from '../../src/lib/project-component/agents/framework/registry'

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

const MOCK_PROPOSED_STRUCTURE: ProposedStructure = {
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
  sequencingRationale: 'Begins with foundational ID theory, then moves to practical application.',
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

const MOCK_OUTCOMES_MAP: OutcomesMap = {
  courseOutcomes: [
    {
      id: 'OC-0-1',
      text: 'Design complete instructional plans using backward design principles aligned to CBSE curriculum standards',
      bloomLevel: 'create',
      measurable: true,
      status: 'draft',
    },
    {
      id: 'OC-0-2',
      text: 'Evaluate the effectiveness of instructional strategies using evidence-based criteria',
      bloomLevel: 'evaluate',
      measurable: true,
      status: 'draft',
    },
    {
      id: 'OC-0-3',
      text: 'Apply active learning techniques to transform traditional CBSE lesson plans',
      bloomLevel: 'apply',
      measurable: true,
      status: 'draft',
    },
  ],
  nodeOutcomes: [
    {
      nodeTitle: 'Foundations of Instructional Design',
      nodePath: 'module-1',
      depth: 1,
      outcomes: [
        {
          id: 'OC-1-1',
          text: 'Compare and contrast ADDIE, SAM, and backward design models for CBSE context',
          bloomLevel: 'analyze',
          measurable: true,
          status: 'draft',
        },
        {
          id: 'OC-1-2',
          text: 'Select the appropriate instructional design model for a given teaching scenario',
          bloomLevel: 'evaluate',
          measurable: true,
          status: 'draft',
        },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 0, analyze: 1, evaluate: 1, create: 0 },
    },
    {
      nodeTitle: 'What is Instructional Design?',
      nodePath: 'module-1/topic-1',
      depth: 2,
      outcomes: [
        {
          id: 'OC-2-1',
          text: 'Explain the three stages of backward design and their purpose in curriculum planning',
          bloomLevel: 'understand',
          measurable: true,
          status: 'draft',
        },
        {
          id: 'OC-2-2',
          text: 'Identify the five phases of the ADDIE model and describe the key activities in each',
          bloomLevel: 'remember',
          measurable: true,
          status: 'draft',
        },
      ],
      bloomDistribution: { remember: 1, understand: 1, apply: 0, analyze: 0, evaluate: 0, create: 0 },
    },
    {
      nodeTitle: 'Learning Outcomes & Alignment',
      nodePath: 'module-1/topic-2',
      depth: 2,
      outcomes: [
        {
          id: 'OC-3-1',
          text: 'Write measurable learning outcomes using action verbs from Bloom\'s taxonomy',
          bloomLevel: 'apply',
          measurable: true,
          status: 'draft',
        },
        {
          id: 'OC-3-2',
          text: 'Align learning outcomes with assessment strategies and instructional activities',
          bloomLevel: 'apply',
          measurable: true,
          status: 'draft',
        },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 2, analyze: 0, evaluate: 0, create: 0 },
    },
    {
      nodeTitle: 'Active Learning Strategies',
      nodePath: 'module-2/topic-1',
      depth: 2,
      outcomes: [
        {
          id: 'OC-4-1',
          text: 'Demonstrate three active learning techniques in a simulated classroom setting',
          bloomLevel: 'apply',
          measurable: true,
          status: 'draft',
        },
        {
          id: 'OC-4-2',
          text: 'Analyze the effectiveness of different engagement strategies for varied CBSE class sizes',
          bloomLevel: 'analyze',
          measurable: true,
          status: 'draft',
        },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 1, analyze: 1, evaluate: 0, create: 0 },
    },
  ],
  totalOutcomes: 11,
  bloomDistribution: { remember: 1, understand: 1, apply: 4, analyze: 2, evaluate: 2, create: 1 },
  coverageNotes: 'Good Bloom progression from foundational understanding to applied creation. All modules and topics have outcomes. Distribution favors apply level, appropriate for experiential program.',
}

const MOCK_COMPONENT_PLAN: ComponentPlan = {
  nodeRecommendations: [
    {
      nodeTitle: 'Foundations of Instructional Design',
      nodePath: 'module-1',
      depth: 1,
      components: [
        {
          componentType: 'study_material',
          priority: 'core',
          rationale: 'Comprehensive reference material for ID models and frameworks',
          estimatedCost: { min: 0.50, max: 2.00 },
        },
        {
          componentType: 'quiz',
          priority: 'recommended',
          rationale: 'Module-level assessment to verify understanding of ID foundations',
          estimatedCost: { min: 0.40, max: 1.50 },
        },
        {
          componentType: 'pre_assessment',
          priority: 'optional',
          rationale: 'Gauge baseline knowledge of instructional design concepts',
          estimatedCost: { min: 0.40, max: 1.50 },
        },
      ],
    },
    {
      nodeTitle: 'What is Instructional Design?',
      nodePath: 'module-1/topic-1',
      depth: 2,
      components: [
        {
          componentType: 'video',
          priority: 'core',
          rationale: 'Visual walkthrough of ADDIE, SAM, and backward design models',
          estimatedCost: { min: 3.00, max: 12.00 },
        },
        {
          componentType: 'study_material',
          priority: 'core',
          rationale: 'Detailed reading on ID model comparisons with CBSE examples',
          estimatedCost: { min: 0.50, max: 2.00 },
        },
        {
          componentType: 'flashcards',
          priority: 'optional',
          rationale: 'Key term review for ID vocabulary and model phases',
          estimatedCost: { min: 0.15, max: 0.50 },
        },
      ],
    },
    {
      nodeTitle: 'Learning Outcomes & Alignment',
      nodePath: 'module-1/topic-2',
      depth: 2,
      components: [
        {
          componentType: 'video',
          priority: 'core',
          rationale: 'Step-by-step demonstration of writing Bloom-aligned outcomes',
          estimatedCost: { min: 3.00, max: 12.00 },
        },
        {
          componentType: 'study_material',
          priority: 'core',
          rationale: 'Reference guide with Bloom verb lists and alignment templates',
          estimatedCost: { min: 0.50, max: 2.00 },
        },
        {
          componentType: 'activity',
          priority: 'recommended',
          rationale: 'Hands-on practice writing outcomes for real CBSE topics',
          estimatedCost: { min: 0.60, max: 2.00 },
        },
      ],
    },
    {
      nodeTitle: 'Active Learning Strategies',
      nodePath: 'module-2/topic-1',
      depth: 2,
      components: [
        {
          componentType: 'video',
          priority: 'core',
          rationale: 'Demonstrations of active learning techniques in classroom settings',
          estimatedCost: { min: 3.00, max: 12.00 },
        },
        {
          componentType: 'study_material',
          priority: 'core',
          rationale: 'Strategy guide with implementation tips for CBSE classrooms',
          estimatedCost: { min: 0.50, max: 2.00 },
        },
        {
          componentType: 'scenario_exercise',
          priority: 'recommended',
          rationale: 'Case study applying engagement strategies to challenging classroom scenarios',
          estimatedCost: { min: 0.80, max: 2.50 },
        },
      ],
    },
  ],
  totalComponents: 12,
  componentBreakdown: {
    video: 3,
    study_material: 4,
    quiz: 1,
    activity: 1,
    flashcards: 1,
    pre_assessment: 1,
    scenario_exercise: 1,
  },
  budgetTiers: [
    {
      name: 'essential',
      description: 'Core videos and study materials for each topic plus module study material',
      totalComponents: 7,
      estimatedCost: { min: 13.50, max: 44.00, currency: 'USD' },
      includedTypes: ['video', 'study_material'],
    },
    {
      name: 'recommended',
      description: 'Adds quiz, activity, and scenario exercise for active learning',
      totalComponents: 10,
      estimatedCost: { min: 15.30, max: 48.00, currency: 'USD' },
      includedTypes: ['video', 'study_material', 'quiz', 'activity', 'scenario_exercise'],
    },
    {
      name: 'comprehensive',
      description: 'Full component set with pre-assessment, flashcards, and all optional components',
      totalComponents: 12,
      estimatedCost: { min: 15.85, max: 50.00, currency: 'USD' },
      includedTypes: ['video', 'study_material', 'quiz', 'activity', 'scenario_exercise', 'flashcards', 'pre_assessment'],
    },
  ],
  rationale: 'Component strategy emphasizes videos and study materials as the core learning backbone, with quizzes and hands-on activities for the experiential focus requested in the brief. Pre-assessment included at module level to gauge baseline. Flashcards optional for terminology-heavy introductory topic.',
}

// ─── Test Suite: Outcome Architect ─────────────────────────────────────────

describe('Outcome Architect Agent', () => {
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
    const executor = await import('../../src/lib/project-component/agents/framework/executor')
    executor.resetClient()
    const mod = await import('../../src/lib/project-component/agents/outcome-architect')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('outcome-architect')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Outcome Architect')
    expect(agent!.tier).toBe('production')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns OutcomesMap on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    })

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('outcome-architect')
    expect(result.output).toBeDefined()
    expect(result.output!.courseOutcomes.length).toBeGreaterThan(0)
    expect(result.output!.nodeOutcomes.length).toBeGreaterThan(0)
    expect(result.output!.totalOutcomes).toBe(11)
    expect(result.output!.coverageNotes).toBeDefined()
  })

  it('every outcome is Bloom-classified and measurable', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    })

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    const validBlooms = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']

    // Check course outcomes
    for (const outcome of result.output!.courseOutcomes) {
      expect(validBlooms).toContain(outcome.bloomLevel)
      expect(outcome.measurable).toBe(true)
      expect(outcome.id).toMatch(/^OC-\d+-\d+$/)
    }

    // Check node outcomes
    for (const node of result.output!.nodeOutcomes) {
      for (const outcome of node.outcomes) {
        expect(validBlooms).toContain(outcome.bloomLevel)
        expect(outcome.measurable).toBe(true)
        expect(outcome.id).toMatch(/^OC-\d+-\d+$/)
      }
    }
  })

  it('provides Bloom distribution per node and aggregate', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    })

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    const bloomKeys = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']

    // Aggregate distribution
    const dist = result.output!.bloomDistribution
    for (const key of bloomKeys) {
      expect(dist).toHaveProperty(key)
      expect(typeof dist[key as keyof typeof dist]).toBe('number')
    }

    // Per-node distribution
    for (const node of result.output!.nodeOutcomes) {
      for (const key of bloomKeys) {
        expect(node.bloomDistribution).toHaveProperty(key)
      }
    }
  })

  it('generates outcomes for every topic in the structure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    })

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    // Should have outcomes for: 2 modules + 3 topics = 4 node entries (modules + topics)
    expect(result.output!.nodeOutcomes.length).toBeGreaterThanOrEqual(3)
  })

  it('includes structure and audience in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runOutcomeArchitect } = await getModule()
    await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Professional Training Course')
    expect(userMsg).toContain('primaryAudience')
    expect(userMsg).toContain('Foundations of Instructional Design')
    expect(userMsg).toContain(BRIEF)
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    })

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.tokensIn).toBe(1200)
    expect(result.tokensOut).toBe(1800)
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runOutcomeArchitect } = await getModule()
    const result = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// ─── Test Suite: Component Recommender ──────────────────────────────────────

describe('Component Recommender Agent', () => {
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
    const executor = await import('../../src/lib/project-component/agents/framework/executor')
    executor.resetClient()
    const mod = await import('../../src/lib/project-component/agents/component-recommender')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('component-recommender')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Component Recommender')
    expect(agent!.tier).toBe('production')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns ComponentPlan on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 2000, output_tokens: 2500 },
    })

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('component-recommender')
    expect(result.output).toBeDefined()
    expect(result.output!.totalComponents).toBe(12)
    expect(result.output!.nodeRecommendations.length).toBeGreaterThan(0)
    expect(result.output!.budgetTiers.length).toBe(3)
    expect(result.output!.rationale).toBeDefined()
  })

  it('respects compatibility matrix — no unavailable components', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 2000, output_tokens: 2500 },
    })

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    // professional_training unavailable: practice_worksheet, video_short
    const unavailable = ['practice_worksheet', 'video_short']
    for (const node of result.output!.nodeRecommendations) {
      for (const comp of node.components) {
        expect(unavailable).not.toContain(comp.componentType)
      }
    }
  })

  it('provides 3 budget tiers with realistic costs', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 2000, output_tokens: 2500 },
    })

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    const tiers = result.output!.budgetTiers
    expect(tiers[0].name).toBe('essential')
    expect(tiers[1].name).toBe('recommended')
    expect(tiers[2].name).toBe('comprehensive')

    // Essential should be cheapest, comprehensive most expensive
    expect(tiers[0].totalComponents).toBeLessThanOrEqual(tiers[1].totalComponents)
    expect(tiers[1].totalComponents).toBeLessThanOrEqual(tiers[2].totalComponents)
    expect(tiers[0].estimatedCost.max).toBeLessThanOrEqual(tiers[2].estimatedCost.max)

    // All tiers should have positive costs
    for (const tier of tiers) {
      expect(tier.estimatedCost.min).toBeGreaterThan(0)
      expect(tier.estimatedCost.max).toBeGreaterThan(0)
      expect(tier.estimatedCost.currency).toBe('USD')
      expect(tier.includedTypes.length).toBeGreaterThan(0)
    }
  })

  it('includes component breakdown by type', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 2000, output_tokens: 2500 },
    })

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    const breakdown = result.output!.componentBreakdown
    const breakdownTotal = Object.values(breakdown).reduce((sum, count) => sum + count, 0)
    expect(breakdownTotal).toBe(result.output!.totalComponents)
  })

  it('includes compatibility data in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runComponentRecommender } = await getModule()
    await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    // Should include component registry table
    expect(userMsg).toContain('Educational Video')
    expect(userMsg).toContain('Study Material')
    expect(userMsg).toContain('Component Registry')
    // Should include unavailable note
    expect(userMsg).toContain('practice_worksheet')
    // Should include outcomes
    expect(userMsg).toContain('courseOutcomes')
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
      usage: { input_tokens: 2000, output_tokens: 2500 },
    })

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    // sonnet: 2000 * $3/MTok + 2500 * $15/MTok = $0.006 + $0.0375 = $0.0435
    expect(result.costUSD).toBeCloseTo(0.0435, 4)
    expect(result.tokensIn).toBe(2000)
    expect(result.tokensOut).toBe(2500)
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runComponentRecommender } = await getModule()
    const result = await runComponentRecommender(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
  })
})

// ─── Chain Test: All 4 Agents ──────────────────────────────────────────────

describe('Stage 0.2 → 0.3 Full Chain (mocked)', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  it('runs audience → curriculum → outcomes → components chain', async () => {
    clearAgents()
    const executor = await import('../../src/lib/project-component/agents/framework/executor')
    executor.resetClient()

    // Import all 4 agents
    const { runAudienceAnalyst, AUDIENCE_ANALYST_CONFIG } = await import('../../src/lib/project-component/agents/audience-analyst')
    const { runCurriculumStrategist, CURRICULUM_STRATEGIST_CONFIG } = await import('../../src/lib/project-component/agents/curriculum-strategist')
    const { runOutcomeArchitect, OUTCOME_ARCHITECT_CONFIG } = await import('../../src/lib/project-component/agents/outcome-architect')
    const { runComponentRecommender, COMPONENT_RECOMMENDER_CONFIG } = await import('../../src/lib/project-component/agents/component-recommender')

    // Re-register since clearAgents removed them and modules are cached
    clearAgents()
    registerAgent(AUDIENCE_ANALYST_CONFIG)
    registerAgent(CURRICULUM_STRATEGIST_CONFIG)
    registerAgent(OUTCOME_ARCHITECT_CONFIG)
    registerAgent(COMPONENT_RECOMMENDER_CONFIG)

    // Mock all 4 API calls in sequence
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
        usage: { input_tokens: 500, output_tokens: 400 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
        usage: { input_tokens: 800, output_tokens: 1200 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
        usage: { input_tokens: 1200, output_tokens: 1800 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
        usage: { input_tokens: 2000, output_tokens: 2500 },
      })

    // Step 1: Audience Analyst
    const audienceResult = await runAudienceAnalyst(BRIEF, 'professional_training')
    expect(audienceResult.success).toBe(true)

    // Step 2: Curriculum Strategist (uses audience output)
    const structureResult = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      audienceResult.output!,
      { totalHours: 40 }
    )
    expect(structureResult.success).toBe(true)

    // Step 3: Outcome Architect (uses structure + audience)
    const outcomesResult = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      structureResult.output!,
      audienceResult.output!
    )
    expect(outcomesResult.success).toBe(true)
    expect(outcomesResult.output!.totalOutcomes).toBe(11)

    // Step 4: Component Recommender (uses structure + outcomes + audience)
    const componentsResult = await runComponentRecommender(
      BRIEF,
      'professional_training',
      structureResult.output!,
      outcomesResult.output!,
      audienceResult.output!
    )
    expect(componentsResult.success).toBe(true)
    expect(componentsResult.output!.totalComponents).toBe(12)
    expect(componentsResult.output!.budgetTiers.length).toBe(3)

    // ─── Chain Validation ───────────────────────────────────────────────

    // Total cost tracked across all 4 agents
    const totalCost = audienceResult.costUSD + structureResult.costUSD +
      outcomesResult.costUSD + componentsResult.costUSD
    expect(totalCost).toBeGreaterThan(0)

    // All 4 agents registered
    expect(listAgents().length).toBeGreaterThanOrEqual(4)
    expect(getAgent('audience-analyst')).toBeDefined()
    expect(getAgent('curriculum-strategist')).toBeDefined()
    expect(getAgent('outcome-architect')).toBeDefined()
    expect(getAgent('component-recommender')).toBeDefined()

    // Print chain summary
    const breakdown = componentsResult.output!.componentBreakdown
    const breakdownStr = Object.entries(breakdown)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ')

    console.log('\n── Chain Test Summary ──')
    console.log(`Total components: ${componentsResult.output!.totalComponents}`)
    console.log(`Cost range: $${componentsResult.output!.budgetTiers[0].estimatedCost.min.toFixed(2)} – $${componentsResult.output!.budgetTiers[2].estimatedCost.max.toFixed(2)}`)
    console.log(`Breakdown: ${breakdownStr}`)
    console.log(`Total agent cost: $${totalCost.toFixed(6)}`)
    console.log(`Bloom distribution: ${JSON.stringify(outcomesResult.output!.bloomDistribution)}`)
    console.log('── End Chain Test ──\n')
  })
})
