// OpenAI GPT-4o text judge adapter.
// Implements JudgeFunction: grades any artifact against a RubricDefinition.
// Cross-model: pair with Claude producer from text-adapter.ts.

import OpenAI from 'openai'
import type {
  DimensionScore,
  GradeReport,
  JudgeFunction,
  RubricDefinition,
} from '../../engine/types'
import { calculateWeightedScore, checkThresholds } from '../grader'
import { calculateCost } from '../pricing'

export interface JudgeCostEvent {
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

export interface OpenAITextJudgeOptions {
  model?: string
  fallbackModel?: string
  client?: Pick<OpenAI, 'chat'>
  onCost?: (event: JudgeCostEvent) => void
}

const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_FALLBACK = 'gpt-4o-mini'

export function buildJudgePrompt(artifact: unknown, rubric: RubricDefinition): string {
  const dimIds = rubric.dimensions.map((d) => d.id)
  const dimBlock = rubric.dimensions
    .map((d) => {
      const anchors = Object.entries(d.criteria)
        .map(([k, v]) => `    ${k}: ${v}`)
        .join('\n')
      return `### ${d.id} — ${d.name} (weight ${d.weight})\n${d.description}\n${anchors}`
    })
    .join('\n\n')

  const content =
    typeof artifact === 'string' ? artifact : JSON.stringify(artifact, null, 2)

  return [
    'You are a rigorous text-quality judge. Follow these rules exactly.',
    '',
    'RULES:',
    '1. Write your reasoning BEFORE giving any scores. Reasoning first — always.',
    '2. Check COMPLETENESS FIRST. If the artifact is truncated, lorem-ipsum filler,',
    '   placeholder text, or missing expected sections, every dimension must score ≤ 4.',
    '3. Use the 1–10 calibration:',
    '   • 1–3 = unusable / broken',
    '   • 4–6 = incomplete or rough',
    '   • 7   = competent',
    '   • 8   = professional',
    '   • 9+  = exceptional (rare)',
    '4. Score each rubric dimension independently, 1–10 (integers or .5 steps).',
    '5. Provide specific, actionable feedback for each dimension.',
    '',
    `## Rubric: ${rubric.name}`,
    '',
    dimBlock,
    '',
    '## Artifact to evaluate',
    '',
    content,
    '',
    '## Output format',
    'Return ONLY a JSON object (no markdown, no prose outside JSON):',
    '{',
    '  "reasoning": "<your reasoning BEFORE the scores, 2-5 sentences>",',
    `  "dimensionScores": [ { "dimensionId": <one of ${dimIds.map((x) => `"${x}"`).join(', ')}>, "score": <1-10>, "feedback": "..." }, ... one per dimension ],`,
    '  "recommendation": "<one-sentence overall verdict>",',
    '  "improvementPriorities": ["...", "..."]',
    '}',
  ].join('\n')
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}

interface RawJudgeResponse {
  reasoning?: string
  dimensionScores: { dimensionId: string; score: number; feedback: string }[]
  recommendation?: string
  improvementPriorities?: string[]
}

function parseJudgeResponse(raw: string): RawJudgeResponse | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw))
    if (parsed && Array.isArray(parsed.dimensionScores) && parsed.dimensionScores.length > 0) {
      return parsed as RawJudgeResponse
    }
    return null
  } catch {
    return null
  }
}

function buildSyntheticFailingGrade(rubric: RubricDefinition): GradeReport {
  const dimensionScores: DimensionScore[] = rubric.dimensions.map((d) => ({
    dimensionId: d.id,
    name: d.name,
    score: 4,
    weight: d.weight,
    feedback: 'Judge response unparseable',
  }))
  return {
    overallScore: 4,
    passesThreshold: false,
    dimensionScores,
    recommendation: 'Judge response unparseable — forcing revision',
    improvementPriorities: [],
  }
}

export function createOpenAITextJudge(opts: OpenAITextJudgeOptions = {}): JudgeFunction {
  const model = opts.model ?? DEFAULT_MODEL
  const fallbackModel = opts.fallbackModel ?? DEFAULT_FALLBACK
  const onCost = opts.onCost

  const client: Pick<OpenAI, 'chat'> =
    opts.client ??
    (() => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set — cannot create OpenAI text judge')
      }
      return new OpenAI({ apiKey })
    })()

  async function callOnce(
    modelId: string,
    prompt: string
  ): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    const res = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    const text = res.choices[0]?.message?.content ?? ''
    return {
      text,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
    }
  }

  async function callWithFallback(
    prompt: string
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; modelUsed: string }> {
    try {
      const r = await callOnce(model, prompt)
      return { ...r, modelUsed: model }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[text-judge] primary ${model} failed: ${msg}. Trying fallback ${fallbackModel}.`
      )
      const r = await callOnce(fallbackModel, prompt)
      return { ...r, modelUsed: fallbackModel }
    }
  }

  return async (artifact: unknown, rubric: RubricDefinition): Promise<GradeReport> => {
    const prompt = buildJudgePrompt(artifact, rubric)

    let text: string
    let tokensIn = 0
    let tokensOut = 0
    let modelUsed = model
    try {
      const r = await callWithFallback(prompt)
      text = r.text
      tokensIn = r.tokensIn
      tokensOut = r.tokensOut
      modelUsed = r.modelUsed
    } catch {
      onCost?.({ model, tokensIn: 0, tokensOut: 0, costUSD: 0 })
      return buildSyntheticFailingGrade(rubric)
    }

    const costUSD = calculateCost(modelUsed, tokensIn, tokensOut)
    onCost?.({ model: modelUsed, tokensIn, tokensOut, costUSD })

    const parsed = parseJudgeResponse(text)
    if (!parsed) return buildSyntheticFailingGrade(rubric)

    const dimensionScores: DimensionScore[] = rubric.dimensions.map((d) => {
      const raw = parsed.dimensionScores.find((x) => x.dimensionId === d.id)
      return {
        dimensionId: d.id,
        name: d.name,
        score: raw ? Number(raw.score) : 4,
        weight: d.weight,
        feedback: raw?.feedback ?? 'No score returned for this dimension',
      }
    })

    const overallScore = calculateWeightedScore(dimensionScores)
    const draft: GradeReport = {
      overallScore,
      passesThreshold: false,
      dimensionScores,
      recommendation: parsed.recommendation ?? '',
      improvementPriorities: parsed.improvementPriorities ?? [],
    }
    const { passes } = checkThresholds(draft, rubric)
    draft.passesThreshold = passes
    return draft
  }
}
