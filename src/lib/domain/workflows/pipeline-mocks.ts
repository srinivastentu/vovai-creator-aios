import type {
  AgentExecutor,
  JudgeFunction,
  GradeReport,
  RubricDefinition,
} from '../../core/engine/types'

const MOCK_ARTIFACTS: Record<string, unknown> = {
  brief: {
    title: 'Mock Course: Introduction to AI',
    goals: ['Understand ML fundamentals', 'Build a simple model'],
    constraints: ['8 hours total', 'No prerequisites beyond basic math'],
    audience_hint: 'Working professionals transitioning to AI roles',
  },
  audience: {
    description: 'Working professionals with 2-5 years experience',
    experience_level: 'intermediate',
    modality_prefs: ['video', 'quiz', 'hands-on-activity'],
  },
  structure: {
    modules: [
      { title: 'Module 1: Foundations', topics: ['What is AI?', 'History of ML'] },
      { title: 'Module 2: Core Concepts', topics: ['Supervised Learning', 'Neural Networks'] },
      { title: 'Module 3: Practical Applications', topics: ['Model Training', 'Deployment'] },
    ],
    topic_count: 6,
    outcome_count: 12,
  },
  components: {
    assignments: [
      { nodeId: 'n1', type: 'video', title: 'Introduction Video' },
      { nodeId: 'n2', type: 'quiz', title: 'Foundations Quiz' },
      { nodeId: 'n3', type: 'activity', title: 'Build a Classifier' },
    ],
    total_components: 18,
  },
  handoff: {
    ready: true,
    cost_estimate: '$45.00',
    timeline: '2 weeks',
  },
}

export function createMockAgentExecutor(): AgentExecutor {
  return async (_agents, _context, state) => {
    return MOCK_ARTIFACTS[state.stageId] ?? { mock: true, stageId: state.stageId }
  }
}

function buildGradeReport(
  score: number,
  rubric: RubricDefinition
): GradeReport {
  const passes = score >= rubric.passThreshold
  return {
    overallScore: score,
    passesThreshold: passes,
    dimensionScores: rubric.dimensions.map((dim) => ({
      dimensionId: dim.id,
      name: dim.name,
      score,
      weight: dim.weight,
      feedback: passes
        ? `${dim.name} meets expectations`
        : `${dim.name} needs improvement`,
    })),
    recommendation: passes ? 'Present to reviewer' : 'Revise and resubmit',
    improvementPriorities: passes ? [] : rubric.dimensions.map((d) => d.name),
  }
}

export function createMockJudge(): JudgeFunction {
  const callCounts = new Map<string, number>()

  return async (_artifact, rubric) => {
    const key = rubric.id
    const count = (callCounts.get(key) ?? 0) + 1
    callCounts.set(key, count)

    const score = count === 1 ? 65 : 80
    return buildGradeReport(score, rubric)
  }
}
