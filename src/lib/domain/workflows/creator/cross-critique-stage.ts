// Stage 5 (Repurpose) Cross-Critique assembly (CR-7) — Domain Workflow.
//
// Wires the LinkedIn + article cross-critique agent sets into Pattern-5 LoopStages
// for the Core Loop Engine. Two producers (Claude + GPT-4o) generate in parallel,
// two cross-model critics critique each other's drafts, a Claude integrator
// synthesizes, and a Gemini judge grades — all routed through the MMS gateway
// (text-generation for producers/critics/integrator; text-scoring for the judge),
// so every call lands in the cost ledger and the hard budget cap (rule 12) counts
// real spend.
//
// All Core machinery is INJECTED: runLoop + runCrossCritiqueIteration own
// orchestration / cost / the cross-model guard / termination; this file supplies
// only the CrossCritiqueConfig (which models) and the CrossCritiqueAdapter (the
// prompts + parsers). The engine never imports this file; this file imports Core.
//
// The CR-4/CR-5 single-producer stages (single-producer-stage.ts) remain intact as
// the Standard-loop path + test doubles; CR-7 adds the cross-critique path beside
// them. The CLI (pipeline-produce.ts) now drives these stages.

import { createInitialState, runLoop } from '../../../core/engine/loop-engine'
import { classifyModelFamily } from '../../../core/engine/cross-critique'
import type {
  CrossCritiqueAdapter,
  CrossCritiqueDeps,
  CrossCritiqueRunnerOptions,
} from '../../../core/engine/cross-critique'
import type {
  AgentExecutor,
  CrossCritiqueConfig,
  CrossCritiqueIterationRecord,
  IterationRecord,
  JudgeFunction,
  LoopStage,
  LoopState,
  TerminationReason,
} from '../../../core/engine/types'
import { getDefaultModels } from '../../../core/models/config/model-inventory'
import { getDefaultGateway } from '../../../core/models/default-gateway'
import type { ModelGateway } from '../../../core/models/gateway'
import type { GatewayResponse } from '../../../core/models/types'

import { preserveImproveBlock } from './agents/cross-critique-shared'
import { LINKEDIN_POST_RUBRIC } from './rubrics/linkedin-post-rubric'
import { LONG_FORM_ARTICLE_RUBRIC } from './rubrics/article-rubric'
import { validateLinkedInPost } from './validators/linkedin-post-validator'
import { validateArticle } from './validators/article-validator'
import { type GeminiTextJudgeDeps } from './agents/gemini-text-judge'

import { createLinkedInJudge, LINKEDIN_JUDGE_AGENT } from './agents/linkedin/judge'
import {
  LINKEDIN_PRODUCER_CLAUDE,
  LINKEDIN_PRODUCER_GPT,
  LINKEDIN_PRODUCER_SYSTEM_PROMPT,
  buildLinkedInProducerUser,
  parseLinkedInArtifact,
} from './agents/linkedin/producer-gpt'
import {
  LINKEDIN_CRITIC_CLAUDE_ON_GPT,
  LINKEDIN_CRITIC_SYSTEM_PROMPT,
  buildLinkedInCriticUser,
  parseLinkedInCritique,
} from './agents/linkedin/critic-claude-on-gpt'
import { LINKEDIN_CRITIC_GPT_ON_CLAUDE } from './agents/linkedin/critic-gpt-on-claude'
import {
  LINKEDIN_INTEGRATOR,
  LINKEDIN_INTEGRATOR_SYSTEM_PROMPT,
  buildLinkedInIntegratorUser,
} from './agents/linkedin/integrator'

import { createArticleJudge, ARTICLE_JUDGE_AGENT } from './agents/article/judge'
import {
  ARTICLE_PRODUCER_CLAUDE,
  ARTICLE_PRODUCER_GPT,
  ARTICLE_PRODUCER_SYSTEM_PROMPT,
  buildArticleProducerUser,
  parseArticleArtifact,
} from './agents/article/producer-gpt'
import {
  ARTICLE_CRITIC_CLAUDE_ON_GPT,
  ARTICLE_CRITIC_SYSTEM_PROMPT,
  buildArticleCriticUser,
  parseArticleCritique,
} from './agents/article/critic-claude-on-gpt'
import { ARTICLE_CRITIC_GPT_ON_CLAUDE } from './agents/article/critic-gpt-on-claude'
import {
  ARTICLE_INTEGRATOR,
  ARTICLE_INTEGRATOR_SYSTEM_PROMPT,
  buildArticleIntegratorUser,
} from './agents/article/integrator'

import type {
  ArticleArtifact,
  LinkedInArtifact,
  RepurposeContext,
  RepurposeCostEvent,
} from './types'

// ─── CR-7 tuning (cross-critique-pattern.md / pipeline-v1.md Stage 5) ──────────
export const CROSS_CRITIQUE_THRESHOLD = 80
export const CROSS_CRITIQUE_MIN_ITERATIONS = 2
export const CROSS_CRITIQUE_MAX_ITERATIONS = 4
export const CROSS_CRITIQUE_MAX_BUDGET_USD = 2.0

const PRODUCER_TEMPERATURE = 0.85
const CRITIC_TEMPERATURE = 0.5
const INTEGRATOR_TEMPERATURE = 0.6
const CRITIC_MAX_OUTPUT_TOKENS = 1024
const LINKEDIN_MAX_OUTPUT_TOKENS = 1600
const ARTICLE_MAX_OUTPUT_TOKENS = 8192

// ─── Catalog-backed model-family classifier (CR-5 follow-up clause 2) ──────────
// Maps modelId → MMS catalog providerId so the rule-10 guard compares providers
// (anthropic / openai / google-gemini), not substrings. Falls back to the
// structural Core classifier for any id not in the catalog.
const PROVIDER_BY_MODEL_ID: Map<string, string> = new Map(
  getDefaultModels().map((m) => [m.id, m.providerId]),
)
export function catalogModelFamily(modelId: string): string {
  return PROVIDER_BY_MODEL_ID.get(modelId) ?? classifyModelFamily(modelId)
}

// ─── Cross-Critique configs (which models play which role) ─────────────────────
export const LINKEDIN_CROSS_CRITIQUE_CONFIG: CrossCritiqueConfig = {
  producers: [LINKEDIN_PRODUCER_CLAUDE, LINKEDIN_PRODUCER_GPT],
  critics: [LINKEDIN_CRITIC_CLAUDE_ON_GPT, LINKEDIN_CRITIC_GPT_ON_CLAUDE],
  // Each critic reads the OTHER model's draft (cross-model perspective).
  criticAssignments: {
    [LINKEDIN_CRITIC_CLAUDE_ON_GPT.id]: LINKEDIN_PRODUCER_GPT.id,
    [LINKEDIN_CRITIC_GPT_ON_CLAUDE.id]: LINKEDIN_PRODUCER_CLAUDE.id,
  },
  integratorAgent: LINKEDIN_INTEGRATOR,
  judgeAgent: LINKEDIN_JUDGE_AGENT,
}

export const ARTICLE_CROSS_CRITIQUE_CONFIG: CrossCritiqueConfig = {
  producers: [ARTICLE_PRODUCER_CLAUDE, ARTICLE_PRODUCER_GPT],
  critics: [ARTICLE_CRITIC_CLAUDE_ON_GPT, ARTICLE_CRITIC_GPT_ON_CLAUDE],
  criticAssignments: {
    [ARTICLE_CRITIC_CLAUDE_ON_GPT.id]: ARTICLE_PRODUCER_GPT.id,
    [ARTICLE_CRITIC_GPT_ON_CLAUDE.id]: ARTICLE_PRODUCER_CLAUDE.id,
  },
  integratorAgent: ARTICLE_INTEGRATOR,
  judgeAgent: ARTICLE_JUDGE_AGENT,
}

// ─── Static stage definitions (no live deps) — re-exported by pipeline-config ──
export const LINKEDIN_POST_STAGE: LoopStage<LinkedInArtifact> = {
  id: 'linkedin-post-cross-critique',
  agents: [LINKEDIN_PRODUCER_CLAUDE, LINKEDIN_PRODUCER_GPT],
  rubric: LINKEDIN_POST_RUBRIC,
  threshold: CROSS_CRITIQUE_THRESHOLD,
  minIterations: CROSS_CRITIQUE_MIN_ITERATIONS,
  maxIterations: CROSS_CRITIQUE_MAX_ITERATIONS,
  loopPattern: 'cross-critique',
  validator: validateLinkedInPost,
  maxBudgetUSD: CROSS_CRITIQUE_MAX_BUDGET_USD,
  crossCritique: LINKEDIN_CROSS_CRITIQUE_CONFIG,
}

export const LONG_FORM_ARTICLE_STAGE: LoopStage<ArticleArtifact> = {
  id: 'long-form-article-cross-critique',
  agents: [ARTICLE_PRODUCER_CLAUDE, ARTICLE_PRODUCER_GPT],
  rubric: LONG_FORM_ARTICLE_RUBRIC,
  threshold: CROSS_CRITIQUE_THRESHOLD,
  minIterations: CROSS_CRITIQUE_MIN_ITERATIONS,
  maxIterations: CROSS_CRITIQUE_MAX_ITERATIONS,
  loopPattern: 'cross-critique',
  validator: validateArticle,
  maxBudgetUSD: CROSS_CRITIQUE_MAX_BUDGET_USD,
  crossCritique: ARTICLE_CROSS_CRITIQUE_CONFIG,
}

// ─── Adapter assembly (the domain seam: prompts + parsers) ─────────────────────
interface RoleKit<T> {
  producerSystemPrompt: string
  buildProducerUser: (ctx: RepurposeContext, feedback: string | null) => string
  criticSystemPrompt: string
  buildCriticUser: (ctx: RepurposeContext, target: T) => string
  parseCritiqueText: (text: string) => string
  integratorSystemPrompt: string
  buildIntegratorUser: (
    ctx: RepurposeContext,
    producerArtifacts: Record<string, T>,
    critiques: Record<string, string>,
    feedback: string | null,
  ) => string
  parseArtifactText: (text: string) => T | null
  maxOutputTokens: number
  /** Text + size preview for the iteration-history panel / cosine similarity. */
  preview: (artifact: T) => { text: string; size: number }
}

const contentOf = (r: GatewayResponse): string =>
  typeof r.result.content === 'string' ? r.result.content : ''

function buildAdapter<T>(kit: RoleKit<T>): CrossCritiqueAdapter<T> {
  return {
    producerRequest: ({ context, feedback }) => ({
      params: {
        systemPrompt: kit.producerSystemPrompt,
        prompt: kit.buildProducerUser(context as RepurposeContext, feedback),
        temperature: PRODUCER_TEMPERATURE,
        maxOutputTokens: kit.maxOutputTokens,
      },
    }),
    criticRequest: ({ context, targetArtifact }) => ({
      params: {
        systemPrompt: kit.criticSystemPrompt,
        prompt: kit.buildCriticUser(context as RepurposeContext, targetArtifact),
        temperature: CRITIC_TEMPERATURE,
        maxOutputTokens: CRITIC_MAX_OUTPUT_TOKENS,
      },
    }),
    integratorRequest: ({ context, producerArtifacts, critiques, feedback }) => ({
      params: {
        systemPrompt: kit.integratorSystemPrompt,
        prompt: kit.buildIntegratorUser(
          context as RepurposeContext,
          producerArtifacts,
          critiques,
          feedback,
        ),
        temperature: INTEGRATOR_TEMPERATURE,
        maxOutputTokens: kit.maxOutputTokens,
      },
    }),
    parseArtifact: (r) => {
      const c = contentOf(r)
      return c ? kit.parseArtifactText(c) : null
    },
    parseCritique: (r) => kit.parseCritiqueText(contentOf(r)),
    feedbackFromGrade: (g) => preserveImproveBlock(g),
  }
}

const LINKEDIN_KIT: RoleKit<LinkedInArtifact> = {
  producerSystemPrompt: LINKEDIN_PRODUCER_SYSTEM_PROMPT,
  buildProducerUser: buildLinkedInProducerUser,
  criticSystemPrompt: LINKEDIN_CRITIC_SYSTEM_PROMPT,
  buildCriticUser: buildLinkedInCriticUser,
  parseCritiqueText: parseLinkedInCritique,
  integratorSystemPrompt: LINKEDIN_INTEGRATOR_SYSTEM_PROMPT,
  buildIntegratorUser: buildLinkedInIntegratorUser,
  parseArtifactText: parseLinkedInArtifact,
  maxOutputTokens: LINKEDIN_MAX_OUTPUT_TOKENS,
  preview: (a) => ({ text: a.text, size: a.charCount }),
}

const ARTICLE_KIT: RoleKit<ArticleArtifact> = {
  producerSystemPrompt: ARTICLE_PRODUCER_SYSTEM_PROMPT,
  buildProducerUser: buildArticleProducerUser,
  criticSystemPrompt: ARTICLE_CRITIC_SYSTEM_PROMPT,
  buildCriticUser: buildArticleCriticUser,
  parseCritiqueText: parseArticleCritique,
  integratorSystemPrompt: ARTICLE_INTEGRATOR_SYSTEM_PROMPT,
  buildIntegratorUser: buildArticleIntegratorUser,
  parseArtifactText: (text) => parseArticleArtifact(text, 'Untitled'),
  maxOutputTokens: ARTICLE_MAX_OUTPUT_TOKENS,
  preview: (a) => ({ text: a.markdown, size: a.wordCount }),
}

// ─── Stage factory ─────────────────────────────────────────────────────────────
export interface CrossCritiqueStageDeps {
  /** MMS gateway producers/critics/integrator + judge route through. Default singleton. */
  gateway?: ModelGateway
  /** Inject the judge (tests). Defaults to the cross-model Gemini judge. */
  judge?: JudgeFunction
  /** Judge model id (cross-model vs producers/integrator). Default gemini-2.5-pro. */
  judgeModelId?: string
  /** Persona voice + audience block for the judge's personaFit / audienceFit dims. */
  personaContext?: string
  threshold?: number
  minIterations?: number
  maxIterations?: number
  maxBudgetUSD?: number
  /** Judge cost passthrough (the runner counts it via getJudgeCostUsd internally). */
  onCost?: (event: RepurposeCostEvent) => void
}

export interface CrossCritiqueStage<T> {
  stage: LoopStage<T>
  adapter: CrossCritiqueAdapter<T>
  judge: JudgeFunction
  gateway: ModelGateway
  options: CrossCritiqueRunnerOptions
  preview: (artifact: T) => { text: string; size: number }
}

interface CrossCritiqueStageSpec<T> {
  staticStage: LoopStage<T>
  kit: RoleKit<T>
  createJudge: (deps: GeminiTextJudgeDeps) => JudgeFunction
  callerTag: string
}

function buildCrossCritiqueStage<T>(
  spec: CrossCritiqueStageSpec<T>,
  deps: CrossCritiqueStageDeps,
): CrossCritiqueStage<T> {
  const gateway = deps.gateway ?? getDefaultGateway()

  // Judge cost seam (CR-6 follow-up): accumulate the gateway-routed judge cost so
  // the runner can fold each iteration's judge spend into cumulativeCostUSD (the
  // budget cap, rule 12). getJudgeCostUsd returns the delta since its last call —
  // i.e. the cost of the single judge call that just ran this iteration.
  let judgeCostAccum = 0
  let judgeCostCounted = 0
  const judge =
    deps.judge ??
    spec.createJudge({
      gateway,
      modelId: deps.judgeModelId,
      personaContext: deps.personaContext,
      onCost: (event) => {
        judgeCostAccum += event.costUSD
        deps.onCost?.(event)
      },
    })
  const getJudgeCostUsd = (): number => {
    const delta = judgeCostAccum - judgeCostCounted
    judgeCostCounted = judgeCostAccum
    return delta
  }

  const options: CrossCritiqueRunnerOptions = {
    classifyFamily: catalogModelFamily,
    getJudgeCostUsd,
    context: { callerTag: spec.callerTag },
    textCapability: 'text-generation',
  }

  // Build the stage, applying any dep overrides. If the judge model is overridden,
  // reflect it in crossCritique.judgeAgent so the rule-10 guard checks the real model.
  let stage: LoopStage<T> = {
    ...spec.staticStage,
    threshold: deps.threshold ?? spec.staticStage.threshold,
    minIterations: deps.minIterations ?? spec.staticStage.minIterations,
    maxIterations: deps.maxIterations ?? spec.staticStage.maxIterations,
    maxBudgetUSD: deps.maxBudgetUSD ?? spec.staticStage.maxBudgetUSD,
  }
  if (deps.judgeModelId && stage.crossCritique) {
    stage = {
      ...stage,
      crossCritique: {
        ...stage.crossCritique,
        judgeAgent: {
          ...stage.crossCritique.judgeAgent,
          model: {
            primary: deps.judgeModelId,
            fallback: stage.crossCritique.judgeAgent.model.fallback,
          },
        },
      },
    }
  }

  return { stage, adapter: buildAdapter(spec.kit), judge, gateway, options, preview: spec.kit.preview }
}

const LINKEDIN_SPEC: CrossCritiqueStageSpec<LinkedInArtifact> = {
  staticStage: LINKEDIN_POST_STAGE,
  kit: LINKEDIN_KIT,
  createJudge: (d) => createLinkedInJudge(d),
  callerTag: 'linkedin-cross-critique',
}

const ARTICLE_SPEC: CrossCritiqueStageSpec<ArticleArtifact> = {
  staticStage: LONG_FORM_ARTICLE_STAGE,
  kit: ARTICLE_KIT,
  createJudge: (d) => createArticleJudge(d),
  callerTag: 'article-cross-critique',
}

export function createLinkedInCrossCritiqueStage(
  deps: CrossCritiqueStageDeps = {},
): CrossCritiqueStage<LinkedInArtifact> {
  return buildCrossCritiqueStage(LINKEDIN_SPEC, deps)
}

export function createArticleCrossCritiqueStage(
  deps: CrossCritiqueStageDeps = {},
): CrossCritiqueStage<ArticleArtifact> {
  return buildCrossCritiqueStage(ARTICLE_SPEC, deps)
}

// ─── Loop driver — runs the engine to a terminal state. Mirrors runProducerLoop ──
const NOOP_EXECUTOR: AgentExecutor = async () => {
  // The cross-critique runner does its own gateway calls; the AgentExecutor is
  // never invoked for loopPattern='cross-critique'. Throwing surfaces any misroute.
  throw new Error('[cross-critique-stage] AgentExecutor must not run for cross-critique')
}

export interface CrossCritiqueIterationEvent {
  version: number
  producers: { agentId: string; snippet: string; size: number }[]
  critiques: { criticId: string; snippet: string }[]
  integratorSnippet: string | null
  score: number | null
  dimensionScores: { name: string; score: number }[]
  /** Integration produced nothing usable OR the integrated artifact failed the validator. */
  judgeSkipped: boolean
  iterationCostUSD: number
}

export interface RunCrossCritiqueLoopArgs<T> {
  stage: CrossCritiqueStage<T>
  context: RepurposeContext
  onIteration?: (event: CrossCritiqueIterationEvent) => void
  /** Snippet length for producer/integrator previews (default 200). */
  snippetChars?: number
}

export interface RunCrossCritiqueLoopResult<T> {
  bestArtifact: T | null
  bestScore: number | null
  iterations: IterationRecord[]
  /** Ordered integrated artifacts (for the consecutive-similarity acceptance check). */
  integratedArtifacts: T[]
  totalCostUSD: number
  terminationReason?: TerminationReason
  finalState: LoopState<T>
  error?: { iteration: number; message: string }
}

export async function runCrossCritiqueLoop<T>(
  args: RunCrossCritiqueLoopArgs<T>,
): Promise<RunCrossCritiqueLoopResult<T>> {
  const { stage, context, onIteration, snippetChars = 200 } = args
  let state = createInitialState<T>(stage.stage.id)
  const deps: CrossCritiqueDeps<T> = {
    gateway: stage.gateway,
    adapter: stage.adapter,
    options: stage.options,
  }
  const integratedArtifacts: T[] = []
  const hardCap = stage.stage.maxIterations * 2 + 4

  let error: { iteration: number; message: string } | undefined
  for (let i = 0; i < hardCap; i++) {
    try {
      state = await runLoop<T>(stage.stage, state, context, NOOP_EXECUTOR, stage.judge, deps)
    } catch (err) {
      error = {
        iteration: state.loopCount + 1,
        message: err instanceof Error ? err.message : String(err),
      }
      if (state.bestArtifact === null) throw err
      state = { ...state, status: 'presenting' }
      break
    }

    const rec = state.iterations[state.iterations.length - 1] as
      | CrossCritiqueIterationRecord
      | undefined
    if (rec) {
      const integrated = (rec.integratedArtifact as T | null) ?? null
      if (integrated !== null) integratedArtifacts.push(integrated)
      onIteration?.({
        version: state.loopCount,
        producers: Object.entries(rec.producerArtifacts).map(([agentId, a]) => {
          const p = stage.preview(a as T)
          return { agentId, snippet: p.text.slice(0, snippetChars), size: p.size }
        }),
        critiques: Object.entries(rec.critiques).map(([criticId, c]) => ({
          criticId,
          snippet: c.slice(0, snippetChars),
        })),
        integratorSnippet: integrated ? stage.preview(integrated).text.slice(0, snippetChars) : null,
        score: rec.judgeGrade?.overallScore ?? null,
        dimensionScores:
          rec.judgeGrade?.dimensionScores.map((d) => ({ name: d.name, score: d.score })) ?? [],
        judgeSkipped: rec.judgeGrade === null,
        iterationCostUSD: rec.iterationCostUSD,
      })
    }

    if (state.status === 'presenting' || state.status === 'approved') break
    if (state.status !== 'revising') break
  }

  return {
    bestArtifact: state.bestArtifact,
    bestScore: state.bestGrade?.overallScore ?? null,
    iterations: state.iterations,
    integratedArtifacts,
    totalCostUSD: state.cumulativeCostUSD,
    terminationReason: state.terminationReason,
    finalState: state,
    ...(error ? { error } : {}),
  }
}
