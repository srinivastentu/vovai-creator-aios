// Generic Rubric Grader — System 2 (Agentic)
// Scores ANY artifact against ANY RubricDefinition.
// Zero domain words. Zero external API imports.

import type {
  DimensionScore,
  GradeReport,
  RubricDefinition,
  JudgeFunction,
} from '../engine/types'

// ─── Pure math ────────────────────────────────────────────────────────────

export function calculateWeightedScore(dimensionScores: DimensionScore[]): number {
  if (dimensionScores.length === 0) return 0
  let total = 0
  for (const ds of dimensionScores) {
    total += ds.score * ds.weight
  }
  return Math.round(total * 100) / 100
}

export function checkThresholds(
  grade: GradeReport,
  rubric: RubricDefinition
): { passes: boolean, failingDimensions: string[] } {
  const failingDimensions: string[] = []

  for (const ds of grade.dimensionScores) {
    const rubricDim = rubric.dimensions.find(d => d.id === ds.dimensionId)
    if (rubricDim && ds.score < rubricDim.passThreshold) {
      failingDimensions.push(ds.dimensionId)
    }
  }

  const passes =
    grade.overallScore >= rubric.passThreshold &&
    failingDimensions.length === 0

  return { passes, failingDimensions }
}

// ─── Prompt builder ───────────────────────────────────────────────────────

function buildGradingPrompt(
  artifact: unknown,
  rubric: RubricDefinition
): string {
  const dimTable = rubric.dimensions
    .map((d, i) =>
      `| ${i + 1} | ${d.name} | ${d.weight} | ${d.description} |`
    )
    .join('\n')

  const dimCriteria = rubric.dimensions
    .map(d => {
      const lines = Object.entries(d.criteria)
        .map(([level, desc]) => `- **${level}:** ${desc}`)
        .join('\n')
      return `### ${d.name} (${d.id})\n${lines}`
    })
    .join('\n\n')

  const dimIds = rubric.dimensions.map(d => `"${d.id}"`).join(', ')

  return `You are an evaluation judge. Score the following artifact against each rubric dimension.

## Rubric: ${rubric.name}

| # | Name | Weight | Description |
|---|------|--------|-------------|
${dimTable}

## Scoring Criteria Per Dimension

${dimCriteria}

## Artifact to Evaluate

${JSON.stringify(artifact, null, 2)}

## Instructions

1. Score each dimension independently on a 0-100 scale using the criteria above.
2. Provide specific, actionable feedback for each dimension.
3. Return ONLY a JSON object with this exact shape:

{
  "dimensionScores": [
    { "dimensionId": <one of ${dimIds}>, "score": <0-100>, "feedback": "..." },
    ...for each dimension
  ],
  "recommendation": "Brief overall assessment",
  "improvementPriorities": ["Priority 1", "Priority 2", ...]
}

Return ONLY the JSON object. No markdown fences, no commentary.`
}

// ─── JSON parsing ─────────────────────────────────────────────────────────

interface RawJudgeResponse {
  dimensionScores: { dimensionId: string, score: number, feedback: string }[]
  recommendation: string
  improvementPriorities: string[]
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim()
}

function parseJudgeResponse(raw: string): RawJudgeResponse | null {
  try {
    const cleaned = stripMarkdownFences(raw)
    const parsed = JSON.parse(cleaned)
    if (
      parsed &&
      Array.isArray(parsed.dimensionScores) &&
      parsed.dimensionScores.length > 0
    ) {
      return parsed as RawJudgeResponse
    }
    return null
  } catch {
    return null
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────

function buildFailingGradeReport(rubric: RubricDefinition): GradeReport {
  return {
    overallScore: 0,
    passesThreshold: false,
    dimensionScores: rubric.dimensions.map(d => ({
      dimensionId: d.id,
      name: d.name,
      score: 0,
      weight: d.weight,
      feedback: 'Failed to parse judge response',
    })),
    recommendation: 'Failed to parse judge response',
    improvementPriorities: [],
  }
}

export function createJudgeFunction(
  callJudgeModel: (prompt: string) => Promise<string>
): JudgeFunction {
  return async (artifact: unknown, rubric: RubricDefinition): Promise<GradeReport> => {
    const prompt = buildGradingPrompt(artifact, rubric)

    let rawResponse: string
    try {
      rawResponse = await callJudgeModel(prompt)
    } catch {
      return buildFailingGradeReport(rubric)
    }

    const parsed = parseJudgeResponse(rawResponse)
    if (!parsed) {
      return buildFailingGradeReport(rubric)
    }

    // Build DimensionScore[] with weights from rubric
    const dimensionScores: DimensionScore[] = parsed.dimensionScores.map(ds => {
      const rubricDim = rubric.dimensions.find(d => d.id === ds.dimensionId)
      return {
        dimensionId: ds.dimensionId,
        name: rubricDim?.name ?? ds.dimensionId,
        score: ds.score,
        weight: rubricDim?.weight ?? 0,
        feedback: ds.feedback,
      }
    })

    const overallScore = calculateWeightedScore(dimensionScores)
    const { passes: passesThreshold } = checkThresholds(
      { overallScore, passesThreshold: false, dimensionScores, recommendation: '', improvementPriorities: [] },
      rubric
    )

    return {
      overallScore,
      passesThreshold,
      dimensionScores,
      recommendation: parsed.recommendation,
      improvementPriorities: parsed.improvementPriorities,
    }
  }
}
