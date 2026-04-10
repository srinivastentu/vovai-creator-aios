// Loop Engine — System 1
// Zero imports from domain/, agentic/, or review/
// All dependencies injected via AgentExecutor and JudgeFunction

import type {
  LoopStage,
  LoopState,
  LoopStatus,
  GradeReport,
  RubricDefinition,
  IterationRecord,
  ReviewAction,
  AgentExecutor,
  JudgeFunction,
} from './types'

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

export function createInitialState<T>(stageId: string): LoopState<T> {
  return {
    stageId,
    status: 'idle',
    currentArtifact: null,
    bestArtifact: null,
    bestGrade: null,
    iterations: [],
    loopCount: 0,
    humanFeedback: [],
    costUSD: 0,
  }
}

// ---------------------------------------------------------------------------
// produce
// ---------------------------------------------------------------------------

export async function produce<T>(
  stage: LoopStage<T>,
  state: LoopState<T>,
  context: unknown,
  agentExecutor: AgentExecutor
): Promise<T> {
  // Rule 5: include humanFeedback in context when present
  const effectiveContext =
    state.humanFeedback.length > 0
      ? { ...(context as Record<string, unknown>), humanFeedback: state.humanFeedback }
      : context

  const result = await agentExecutor(stage.agents, effectiveContext, state as LoopState<unknown>)
  return result as T
}

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

export async function evaluate<T>(
  artifact: T,
  rubric: RubricDefinition,
  judge: JudgeFunction
): Promise<GradeReport> {
  return judge(artifact, rubric)
}

// ---------------------------------------------------------------------------
// runLoop — ONE iteration, caller loops externally
// ---------------------------------------------------------------------------

export async function runLoop<T>(
  stage: LoopStage<T>,
  state: LoopState<T>,
  context: unknown,
  agentExecutor: AgentExecutor,
  judge: JudgeFunction
): Promise<LoopState<T>> {
  let current = { ...state }

  // a. Set status to generating
  current.status = 'generating'

  // b. Produce artifact
  const artifact = await produce(stage, current, context, agentExecutor)
  current.currentArtifact = artifact

  // c. Run validator if present
  if (stage.validator) {
    current.status = 'validating'
    const validation = stage.validator(artifact)
    if (!validation.valid) {
      current.status = 'revising'
      current.loopCount += 1
      current.humanFeedback = []
      return current
    }
  }

  // d. Evaluate
  current.status = 'evaluating'
  const grade = await evaluate(artifact, stage.rubric, judge)

  // f. Create iteration record
  const version = current.iterations.length + 1
  const record: IterationRecord = {
    artifactId: `${stage.id}-v${version}`,
    version,
    grade,
    modelUsed: stage.agents[0]?.model.primary ?? 'unknown',
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0,
    createdAt: new Date(),
  }

  // g. Add to iterations (immutable)
  current = {
    ...current,
    iterations: [...current.iterations, record],
  }

  // h. Track best artifact (rule 2)
  if (
    current.bestGrade === null ||
    grade.overallScore > current.bestGrade.overallScore
  ) {
    current.bestArtifact = artifact
    current.bestGrade = grade
  }

  // i. Increment loopCount
  current.loopCount += 1

  // j. Clear humanFeedback after use (rule 5)
  current.humanFeedback = []

  // k. Decide next status
  const meetsThreshold = grade.overallScore >= stage.threshold
  const meetsMinIterations = current.loopCount >= stage.minIterations
  const atMaxIterations = current.loopCount >= stage.maxIterations

  if (atMaxIterations) {
    // Escalation — present best to human regardless of score
    current.status = 'presenting'
  } else if (!meetsMinIterations) {
    // Rule 1: force minimum iterations even if score passes
    current.status = 'revising'
  } else if (meetsThreshold) {
    current.status = 'presenting'
  } else {
    current.status = 'revising'
  }

  return current
}

// ---------------------------------------------------------------------------
// processReview — handles human decision
// ---------------------------------------------------------------------------

export function processReview<T>(
  state: LoopState<T>,
  action: ReviewAction
): LoopState<T> {
  let current = { ...state }

  // If editedArtifact exists, update currentArtifact first
  if (action.editedArtifact !== undefined) {
    current.currentArtifact = action.editedArtifact as T
  }

  switch (action.type) {
    case 'approve':
      current.status = 'approved'
      break

    case 'reject':
      current.status = 'generating'
      current.iterations = []
      current.loopCount = 0
      current.humanFeedback = []
      break

    case 'feedback':
      current.status = 'generating'
      current.humanFeedback = [
        ...current.humanFeedback,
        ...(action.message ? [action.message] : []),
      ]
      break

    case 'use_segments':
      current.status = 'generating'
      break

    case 'mix_produce':
      current.status = 'generating'
      break
  }

  return current
}
