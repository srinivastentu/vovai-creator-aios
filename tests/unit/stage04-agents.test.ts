import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  AudienceProfile,
  OutcomesMap,
  ComponentPlan,
  ProposedStructure,
  OptimizationReport,
  GradeReport,
  DevilsAdvocateReport,
} from '../../src/lib/project-component/types'
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
  courseDescription: 'A 40-hour experiential program.',
  modules: [
    {
      title: 'Foundations of Instructional Design',
      description: 'Core ID principles and frameworks',
      topics: [
        {
          title: 'What is Instructional Design?',
          description: 'Overview of ID models',
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
    { id: 'OC-0-1', text: 'Design complete instructional plans', bloomLevel: 'create', measurable: true, status: 'draft' },
    { id: 'OC-0-2', text: 'Evaluate instructional strategies', bloomLevel: 'evaluate', measurable: true, status: 'draft' },
  ],
  nodeOutcomes: [
    {
      nodeTitle: 'Foundations of Instructional Design',
      nodePath: 'module-1',
      depth: 1,
      outcomes: [
        { id: 'OC-1-1', text: 'Compare ADDIE, SAM, and backward design', bloomLevel: 'analyze', measurable: true, status: 'draft' },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 0, analyze: 1, evaluate: 0, create: 0 },
    },
    {
      nodeTitle: 'What is Instructional Design?',
      nodePath: 'module-1/topic-1',
      depth: 2,
      outcomes: [
        { id: 'OC-2-1', text: 'Explain backward design stages', bloomLevel: 'understand', measurable: true, status: 'draft' },
      ],
      bloomDistribution: { remember: 0, understand: 1, apply: 0, analyze: 0, evaluate: 0, create: 0 },
    },
    {
      nodeTitle: 'Learning Outcomes & Alignment',
      nodePath: 'module-1/topic-2',
      depth: 2,
      outcomes: [
        { id: 'OC-3-1', text: 'Write measurable learning outcomes', bloomLevel: 'apply', measurable: true, status: 'draft' },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 1, analyze: 0, evaluate: 0, create: 0 },
    },
    {
      nodeTitle: 'Active Learning Strategies',
      nodePath: 'module-2/topic-1',
      depth: 2,
      outcomes: [
        { id: 'OC-4-1', text: 'Demonstrate active learning techniques', bloomLevel: 'apply', measurable: true, status: 'draft' },
      ],
      bloomDistribution: { remember: 0, understand: 0, apply: 1, analyze: 0, evaluate: 0, create: 0 },
    },
  ],
  totalOutcomes: 6,
  bloomDistribution: { remember: 0, understand: 1, apply: 2, analyze: 1, evaluate: 1, create: 1 },
  coverageNotes: 'Good Bloom progression.',
}

const MOCK_COMPONENT_PLAN: ComponentPlan = {
  nodeRecommendations: [
    {
      nodeTitle: 'Foundations of Instructional Design',
      nodePath: 'module-1',
      depth: 1,
      components: [
        { componentType: 'study_material', priority: 'core', rationale: 'Reference material', estimatedCost: { min: 0.50, max: 2.00 } },
        { componentType: 'quiz', priority: 'recommended', rationale: 'Module assessment', estimatedCost: { min: 0.40, max: 1.50 } },
      ],
    },
    {
      nodeTitle: 'What is Instructional Design?',
      nodePath: 'module-1/topic-1',
      depth: 2,
      components: [
        { componentType: 'video', priority: 'core', rationale: 'Visual walkthrough', estimatedCost: { min: 3.00, max: 12.00 } },
        { componentType: 'study_material', priority: 'core', rationale: 'Detailed reading', estimatedCost: { min: 0.50, max: 2.00 } },
      ],
    },
    {
      nodeTitle: 'Learning Outcomes & Alignment',
      nodePath: 'module-1/topic-2',
      depth: 2,
      components: [
        { componentType: 'video', priority: 'core', rationale: 'Step-by-step demo', estimatedCost: { min: 3.00, max: 12.00 } },
        { componentType: 'activity', priority: 'recommended', rationale: 'Hands-on practice', estimatedCost: { min: 0.60, max: 2.00 } },
      ],
    },
    {
      nodeTitle: 'Active Learning Strategies',
      nodePath: 'module-2/topic-1',
      depth: 2,
      components: [
        { componentType: 'video', priority: 'core', rationale: 'Demonstrations', estimatedCost: { min: 3.00, max: 12.00 } },
        { componentType: 'scenario_exercise', priority: 'recommended', rationale: 'Case study', estimatedCost: { min: 0.80, max: 2.50 } },
      ],
    },
  ],
  totalComponents: 8,
  componentBreakdown: { video: 3, study_material: 2, quiz: 1, activity: 1, scenario_exercise: 1 },
  budgetTiers: [
    { name: 'essential', description: 'Core only', totalComponents: 5, estimatedCost: { min: 10.00, max: 40.00, currency: 'USD' }, includedTypes: ['video', 'study_material'] },
    { name: 'recommended', description: 'Core + recommended', totalComponents: 7, estimatedCost: { min: 11.80, max: 44.00, currency: 'USD' }, includedTypes: ['video', 'study_material', 'quiz', 'activity', 'scenario_exercise'] },
    { name: 'comprehensive', description: 'All components', totalComponents: 8, estimatedCost: { min: 11.80, max: 44.00, currency: 'USD' }, includedTypes: ['video', 'study_material', 'quiz', 'activity', 'scenario_exercise'] },
  ],
  rationale: 'Videos and study materials form the backbone.',
}

// ─── Mock Agent Outputs ───────────────────────────────────────────────────

const MOCK_OPTIMIZATION_REPORT: OptimizationReport = {
  healthScore: 78,
  criticalIssues: [],
  warnings: [
    {
      type: 'balance',
      severity: 'warning',
      location: 'module-1 vs module-2',
      description: 'Module 1 has 2 topics while Module 2 has only 1. This creates an imbalanced learning experience.',
      suggestedAction: 'Add a second topic to Module 2 or redistribute topics between modules.',
    },
    {
      type: 'gap',
      severity: 'warning',
      location: 'module-2',
      description: 'No assessment component in Module 2. Learners complete the module without any knowledge check.',
      suggestedAction: 'Add a quiz or post-assessment to Module 2.',
    },
  ],
  suggestions: [
    {
      type: 'sequencing',
      severity: 'suggestion',
      location: 'module-1/topic-2',
      description: 'Learning Outcomes & Alignment could benefit from a prerequisite on assessment basics.',
      suggestedAction: 'Consider adding a brief intro to assessment concepts before alignment topic.',
    },
  ],
  actions: [
    'Balance modules: add a second topic to Module 2',
    'Add assessment to Module 2',
    'Consider prerequisite for alignment topic',
  ],
  summary: 'The structure is generally sound with good progression from theory to practice. Two module-level balance issues need attention — Module 1 has twice the content of Module 2, and Module 2 lacks assessment. Addressing these will improve the learning experience significantly.',
}

const MOCK_RAW_GRADE_OUTPUT = {
  dimensionScores: [
    { dimensionId: 'coverage', score: 80, feedback: 'Good coverage of ID concepts. Minor gap in assessment design.' },
    { dimensionId: 'depth', score: 75, feedback: 'Appropriate depth for most topics. Subtopics add useful granularity.' },
    { dimensionId: 'progression', score: 82, feedback: 'Clear logical flow from foundations to application.' },
    { dimensionId: 'balance', score: 65, feedback: 'Module 1 has 2 topics, Module 2 only 1. Imbalanced.' },
    { dimensionId: 'engagement', score: 78, feedback: 'Good mix of videos and activities. Could use more hands-on components.' },
    { dimensionId: 'feasibility', score: 85, feedback: 'Scope is realistic for timeline and budget.' },
    { dimensionId: 'coherence', score: 77, feedback: 'Components generally serve outcomes. One quiz lacks explicit outcome mapping.' },
  ],
  strengths: [
    'Clear logical progression from foundational to applied topics',
    'Good use of experiential components (activities, scenario exercises)',
    'Realistic scope for the timeline',
  ],
  weaknesses: [
    'Module imbalance — Module 1 has twice the content of Module 2',
    'Missing assessment in Module 2',
  ],
  specificImprovements: [
    'Add a second topic to Module 2 for better balance',
    'Add a quiz or assessment to Module 2',
    'Map the Module 1 quiz explicitly to specific learning outcomes',
    'Consider adding a capstone synthesis activity',
  ],
}

const MOCK_DEVILS_ADVOCATE_REPORT: DevilsAdvocateReport = {
  challenges: [
    {
      assumption: 'Teachers will complete all 40 hours of self-paced content',
      perspective: 'Busy mid-career teacher with limited free time',
      severity: 'high',
      concern: 'Self-paced completion rates for 40-hour courses are typically 10-15%. Teachers with 5-15 years experience have heavy workloads.',
      suggestion: 'Add cohort-based checkpoints every 2 weeks, or reduce core content to 20 hours.',
    },
    {
      assumption: 'Video-heavy content is the best format for experienced teachers',
      perspective: 'Teacher who has sat through too many bad PD videos',
      severity: 'medium',
      concern: 'Experienced teachers often prefer peer discussion and case studies over watching videos. The structure leans heavily on video as the primary content delivery.',
      suggestion: 'Increase discussion prompts and peer activities. Consider making some videos optional with text alternatives.',
    },
    {
      assumption: 'Bloom progression from understand to apply is sufficient',
      perspective: 'Instructional design expert evaluating the course',
      severity: 'medium',
      concern: 'The course is about instructional design but only reaches apply level. Teachers should be designing courses (create level) by the end.',
      suggestion: 'Add a synthesis module where teachers create their own instructional designs.',
    },
    {
      assumption: 'One quiz per module adequately assesses understanding',
      perspective: 'Assessment specialist',
      severity: 'medium',
      concern: 'A single module-level quiz may not adequately assess the range of outcomes covered in each module.',
      suggestion: 'Add topic-level formative checks and a pre/post assessment at the course level.',
    },
    {
      assumption: 'Teachers have sufficient technology comfort for self-paced online learning',
      perspective: 'Rural CBSE teacher with limited internet access',
      severity: 'low',
      concern: 'While rated as intermediate tech comfort, many CBSE teachers in smaller cities may struggle with consistent internet access for video streaming.',
      suggestion: 'Provide downloadable content options and ensure study materials can be accessed offline.',
    },
  ],
  overallRiskLevel: 'medium',
  topConcerns: [
    'Completion rate risk for 40-hour self-paced format',
    'Insufficient Bloom progression — stops at apply instead of create',
    'Over-reliance on video format for experienced adult learners',
  ],
  summary: 'The course structure is pedagogically sound but makes optimistic assumptions about learner commitment and self-regulation. The biggest risk is the 40-hour self-paced format for busy teachers. Additionally, the course should push learners to create-level activities given that the subject is instructional design itself.',
}

// ─── Test Suite: Structure Optimizer ──────────────────────────────────────

describe('Structure Optimizer Agent', () => {
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
    const mod = await import('../../src/lib/project-component/agents/structure-optimizer')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('structure-optimizer')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Structure Optimizer')
    expect(agent!.tier).toBe('governance')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns OptimizationReport on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
      usage: { input_tokens: 2500, output_tokens: 1200 },
    })

    const { runStructureOptimizer } = await getModule()
    const result = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('structure-optimizer')
    expect(result.output).toBeDefined()
    expect(result.output!.healthScore).toBe(78)
    expect(result.output!.summary).toBeDefined()
    expect(result.output!.actions.length).toBeGreaterThan(0)
  })

  it('detects imbalanced modules', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
      usage: { input_tokens: 2500, output_tokens: 1200 },
    })

    const { runStructureOptimizer } = await getModule()
    const result = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // Should flag balance issues
    const allIssues = [...result.output!.criticalIssues, ...result.output!.warnings, ...result.output!.suggestions]
    const balanceIssues = allIssues.filter(i => i.type === 'balance')
    expect(balanceIssues.length).toBeGreaterThan(0)

    // Each issue should have required fields
    for (const issue of allIssues) {
      expect(issue.type).toBeDefined()
      expect(issue.severity).toBeDefined()
      expect(issue.location).toBeDefined()
      expect(issue.description).toBeDefined()
      expect(issue.suggestedAction).toBeDefined()
    }
  })

  it('categorizes issues by severity', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
      usage: { input_tokens: 2500, output_tokens: 1200 },
    })

    const { runStructureOptimizer } = await getModule()
    const result = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // Critical issues should all have severity 'critical'
    for (const issue of result.output!.criticalIssues) {
      expect(issue.severity).toBe('critical')
    }
    // Warnings should all have severity 'warning'
    for (const issue of result.output!.warnings) {
      expect(issue.severity).toBe('warning')
    }
    // Suggestions should all have severity 'suggestion'
    for (const issue of result.output!.suggestions) {
      expect(issue.severity).toBe('suggestion')
    }
  })

  it('includes structure and component plan in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runStructureOptimizer } = await getModule()
    await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain(BRIEF)
    expect(userMsg).toContain('Professional Training Course')
    expect(userMsg).toContain('Foundations of Instructional Design')
    expect(userMsg).toContain('Component Plan')
    expect(userMsg).toContain('Learning Outcomes')
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
      usage: { input_tokens: 2500, output_tokens: 1200 },
    })

    const { runStructureOptimizer } = await getModule()
    const result = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.tokensIn).toBe(2500)
    expect(result.tokensOut).toBe(1200)
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runStructureOptimizer } = await getModule()
    const result = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// ─── Test Suite: Rubric Grader ────────────────────────────────────────────

describe('Rubric Grader Agent', () => {
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
    const mod = await import('../../src/lib/project-component/agents/rubric-grader')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('rubric-grader')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('Rubric Grader')
    expect(agent!.tier).toBe('governance')
    expect(agent!.model.primary).toBe('claude-sonnet-4-20250514')
  })

  it('returns GradeReport with all 7 dimensions scored', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('rubric-grader')
    expect(result.output).toBeDefined()
    expect(result.output!.dimensionScores.length).toBe(7)
    expect(result.output!.overallScore).toBeGreaterThan(0)
    expect(result.output!.recommendation).toBeDefined()
    expect(typeof result.output!.passesThreshold).toBe('boolean')
  })

  it('uses calculateOverallScore() for deterministic scoring', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // Manually compute expected score:
    // coverage: 80 * 0.18 = 14.40
    // depth: 75 * 0.15 = 11.25
    // progression: 82 * 0.18 = 14.76
    // balance: 65 * 0.12 = 7.80
    // engagement: 78 * 0.15 = 11.70
    // feasibility: 85 * 0.10 = 8.50
    // coherence: 77 * 0.12 = 9.24
    // Total: 77.65
    expect(result.output!.overallScore).toBeCloseTo(77.65, 1)
  })

  it('uses getRecommendation() for deterministic recommendation', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // balance score is 65, passThreshold is 65 — passes (not strictly less than)
    // Overall 77.65 >= 75, 0 failing dimensions → 'revise' (not 'approve' because < 85)
    expect(result.output!.recommendation).toBe('revise')
  })

  it('detects failing dimensions correctly', async () => {
    const lowBalanceOutput = {
      ...MOCK_RAW_GRADE_OUTPUT,
      dimensionScores: MOCK_RAW_GRADE_OUTPUT.dimensionScores.map(ds =>
        ds.dimensionId === 'balance' ? { ...ds, score: 50 } : ds
      ),
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(lowBalanceOutput) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // balance=50 < passThreshold=65 → failing
    // This means passesThreshold=false (even if overall > 75)
    expect(result.output!.passesThreshold).toBe(false)

    // With 1 failing dimension and overall ~75.85, should be 'revise'
    expect(result.output!.recommendation).toBe('revise')
  })

  it('includes rubric dimensions in system prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runRubricGrader } = await getModule()
    await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMsg = callArgs.system
    // System prompt should include all 7 dimension names
    expect(systemMsg).toContain('Coverage')
    expect(systemMsg).toContain('Depth')
    expect(systemMsg).toContain('Progression')
    expect(systemMsg).toContain('Balance')
    expect(systemMsg).toContain('Engagement')
    expect(systemMsg).toContain('Feasibility')
    expect(systemMsg).toContain('Coherence')
  })

  it('includes strengths, weaknesses, and improvements', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.output!.strengths.length).toBeGreaterThan(0)
    expect(result.output!.weaknesses.length).toBeGreaterThan(0)
    expect(result.output!.specificImprovements.length).toBeGreaterThan(0)
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
      usage: { input_tokens: 3000, output_tokens: 2000 },
    })

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    // sonnet: 3000 * $3/MTok + 2000 * $15/MTok = $0.009 + $0.03 = $0.039
    expect(result.costUSD).toBeCloseTo(0.039, 4)
    expect(result.tokensIn).toBe(3000)
    expect(result.tokensOut).toBe(2000)
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runRubricGrader } = await getModule()
    const result = await runRubricGrader(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// ─── Test Suite: Devil's Advocate ─────────────────────────────────────────

describe("Devil's Advocate Agent", () => {
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
    const mod = await import('../../src/lib/project-component/agents/devils-advocate')
    return mod
  }

  it('registers itself in the agent registry', async () => {
    await getModule()
    const agent = getAgent('devils-advocate')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe("Devil's Advocate")
    expect(agent!.tier).toBe('governance')
  })

  it('returns DevilsAdvocateReport on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })

    const { runDevilsAdvocate } = await getModule()
    const result = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(true)
    expect(result.agentId).toBe('devils-advocate')
    expect(result.output).toBeDefined()
    expect(result.output!.challenges.length).toBeGreaterThan(0)
    expect(result.output!.overallRiskLevel).toBeDefined()
    expect(result.output!.topConcerns.length).toBeGreaterThan(0)
    expect(result.output!.summary).toBeDefined()
  })

  it('returns meaningful challenges with severity', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })

    const { runDevilsAdvocate } = await getModule()
    const result = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    const validSeverities = ['high', 'medium', 'low']
    for (const challenge of result.output!.challenges) {
      expect(challenge.assumption).toBeDefined()
      expect(challenge.perspective).toBeDefined()
      expect(validSeverities).toContain(challenge.severity)
      expect(challenge.concern).toBeDefined()
      expect(challenge.suggestion).toBeDefined()
    }
  })

  it('includes at least one high-severity challenge', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })

    const { runDevilsAdvocate } = await getModule()
    const result = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    const highSeverity = result.output!.challenges.filter(c => c.severity === 'high')
    expect(highSeverity.length).toBeGreaterThan(0)
  })

  it('includes audience and brief in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const { runDevilsAdvocate } = await getModule()
    await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain(BRIEF)
    expect(userMsg).toContain('primaryAudience')
    expect(userMsg).toContain('Component Plan')
  })

  it('tracks cost for the call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })

    const { runDevilsAdvocate } = await getModule()
    const result = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.tokensIn).toBe(2000)
    expect(result.tokensOut).toBe(1500)
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('returns error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const { runDevilsAdvocate } = await getModule()
    const result = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      MOCK_PROPOSED_STRUCTURE,
      MOCK_OUTCOMES_MAP,
      MOCK_COMPONENT_PLAN,
      MOCK_AUDIENCE_PROFILE
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// ─── Chain Test: Full 7-Agent Pipeline ────────────────────────────────────

describe('Full 7-Agent Pipeline Chain (mocked)', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  it('runs all 7 agents in sequence and produces final grade + challenges', async () => {
    clearAgents()
    const executor = await import('../../src/lib/project-component/agents/framework/executor')
    executor.resetClient()

    // Import all 7 agents
    const { runAudienceAnalyst, AUDIENCE_ANALYST_CONFIG } = await import('../../src/lib/project-component/agents/audience-analyst')
    const { runCurriculumStrategist, CURRICULUM_STRATEGIST_CONFIG } = await import('../../src/lib/project-component/agents/curriculum-strategist')
    const { runOutcomeArchitect, OUTCOME_ARCHITECT_CONFIG } = await import('../../src/lib/project-component/agents/outcome-architect')
    const { runComponentRecommender, COMPONENT_RECOMMENDER_CONFIG } = await import('../../src/lib/project-component/agents/component-recommender')
    const { runStructureOptimizer, STRUCTURE_OPTIMIZER_CONFIG } = await import('../../src/lib/project-component/agents/structure-optimizer')
    const { runRubricGrader, RUBRIC_GRADER_CONFIG } = await import('../../src/lib/project-component/agents/rubric-grader')
    const { runDevilsAdvocate, DEVILS_ADVOCATE_CONFIG } = await import('../../src/lib/project-component/agents/devils-advocate')

    // Re-register since clearAgents removed them and modules are cached
    clearAgents()
    registerAgent(AUDIENCE_ANALYST_CONFIG)
    registerAgent(CURRICULUM_STRATEGIST_CONFIG)
    registerAgent(OUTCOME_ARCHITECT_CONFIG)
    registerAgent(COMPONENT_RECOMMENDER_CONFIG)
    registerAgent(STRUCTURE_OPTIMIZER_CONFIG)
    registerAgent(RUBRIC_GRADER_CONFIG)
    registerAgent(DEVILS_ADVOCATE_CONFIG)

    // Mock all 7 API calls in sequence
    mockCreate
      // 1. Audience Analyst
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_AUDIENCE_PROFILE) }],
        usage: { input_tokens: 500, output_tokens: 400 },
      })
      // 2. Curriculum Strategist
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_PROPOSED_STRUCTURE) }],
        usage: { input_tokens: 800, output_tokens: 1200 },
      })
      // 3. Outcome Architect
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_OUTCOMES_MAP) }],
        usage: { input_tokens: 1200, output_tokens: 1800 },
      })
      // 4. Component Recommender
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_COMPONENT_PLAN) }],
        usage: { input_tokens: 2000, output_tokens: 2500 },
      })
      // 5. Structure Optimizer
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_OPTIMIZATION_REPORT) }],
        usage: { input_tokens: 2500, output_tokens: 1200 },
      })
      // 6. Rubric Grader
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_RAW_GRADE_OUTPUT) }],
        usage: { input_tokens: 3000, output_tokens: 2000 },
      })
      // 7. Devil's Advocate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(MOCK_DEVILS_ADVOCATE_REPORT) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      })

    // ─── Stage 0.2: Production Agents ─────────────────────────────────

    // Step 1: Audience Analyst
    const audienceResult = await runAudienceAnalyst(BRIEF, 'professional_training')
    expect(audienceResult.success).toBe(true)

    // Step 2: Curriculum Strategist
    const structureResult = await runCurriculumStrategist(
      BRIEF,
      'professional_training',
      audienceResult.output!,
      { totalHours: 40 }
    )
    expect(structureResult.success).toBe(true)

    // ─── Stage 0.3: Production Agents ─────────────────────────────────

    // Step 3: Outcome Architect
    const outcomesResult = await runOutcomeArchitect(
      BRIEF,
      'professional_training',
      structureResult.output!,
      audienceResult.output!
    )
    expect(outcomesResult.success).toBe(true)

    // Step 4: Component Recommender
    const componentsResult = await runComponentRecommender(
      BRIEF,
      'professional_training',
      structureResult.output!,
      outcomesResult.output!,
      audienceResult.output!
    )
    expect(componentsResult.success).toBe(true)

    // ─── Stage 0.4: Governance Agents ─────────────────────────────────

    // Step 5: Structure Optimizer
    const optimizerResult = await runStructureOptimizer(
      BRIEF,
      'professional_training',
      structureResult.output!,
      outcomesResult.output!,
      componentsResult.output!,
      audienceResult.output!
    )
    expect(optimizerResult.success).toBe(true)
    expect(optimizerResult.output!.healthScore).toBe(78)

    // Step 6: Rubric Grader
    const gradeResult = await runRubricGrader(
      BRIEF,
      'professional_training',
      structureResult.output!,
      outcomesResult.output!,
      componentsResult.output!,
      audienceResult.output!
    )
    expect(gradeResult.success).toBe(true)
    expect(gradeResult.output!.dimensionScores.length).toBe(7)
    expect(gradeResult.output!.overallScore).toBeGreaterThan(0)
    expect(gradeResult.output!.recommendation).toBeDefined()

    // Step 7: Devil's Advocate
    const criticResult = await runDevilsAdvocate(
      BRIEF,
      'professional_training',
      structureResult.output!,
      outcomesResult.output!,
      componentsResult.output!,
      audienceResult.output!
    )
    expect(criticResult.success).toBe(true)
    expect(criticResult.output!.challenges.length).toBeGreaterThan(0)

    // ─── Chain Validations ────────────────────────────────────────────

    // All 7 agents registered
    expect(listAgents().length).toBe(7)
    expect(getAgent('audience-analyst')).toBeDefined()
    expect(getAgent('curriculum-strategist')).toBeDefined()
    expect(getAgent('outcome-architect')).toBeDefined()
    expect(getAgent('component-recommender')).toBeDefined()
    expect(getAgent('structure-optimizer')).toBeDefined()
    expect(getAgent('rubric-grader')).toBeDefined()
    expect(getAgent('devils-advocate')).toBeDefined()

    // Total cost tracked across all 7 agents
    const totalCost =
      audienceResult.costUSD +
      structureResult.costUSD +
      outcomesResult.costUSD +
      componentsResult.costUSD +
      optimizerResult.costUSD +
      gradeResult.costUSD +
      criticResult.costUSD
    expect(totalCost).toBeGreaterThan(0)

    // All 7 API calls were made
    expect(mockCreate).toHaveBeenCalledTimes(7)

    // Print chain summary
    const grade = gradeResult.output!
    const topChallenges = criticResult.output!.topConcerns.slice(0, 3)

    console.log('\n── 7-Agent Chain Test Summary ──')
    console.log(`Grade: ${grade.overallScore.toFixed(2)}/100 → ${grade.recommendation}`)
    console.log(`Passes threshold: ${grade.passesThreshold}`)
    console.log(`Health score: ${optimizerResult.output!.healthScore}/100`)
    console.log(`Critical issues: ${optimizerResult.output!.criticalIssues.length}`)
    console.log(`Warnings: ${optimizerResult.output!.warnings.length}`)
    console.log(`Risk level: ${criticResult.output!.overallRiskLevel}`)
    console.log(`Top 3 challenges:`)
    topChallenges.forEach((c, i) => console.log(`  ${i + 1}. ${c}`))
    console.log(`Total agent cost: $${totalCost.toFixed(6)}`)
    console.log('── End 7-Agent Chain Test ──\n')
  })
})
