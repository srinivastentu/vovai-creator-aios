// CreatorOS Domain types — Stage 2 (Research) artifacts.
// These are CreatorOS-specific pipeline shapes (the ResearchDossier flows
// into Stage 3's Long-Form Master). They are NOT Core: a Film AIOS would
// shape its research differently.

/** One curated source in a ResearchDossier. */
export interface DossierSource {
  url: string
  title: string
  /** Why this source matters — grounding excerpt or curator's relevance note. */
  snippet: string
  /** V1 research is web-only; uploads land here in a later phase. */
  type: 'web' | 'upload'
  /** Anthropic page-age hint when known. */
  pageAge?: string | null
}

/**
 * Stage 2 output. Produced by the Research Agent, refined by the Source
 * Curator, graded by the Research Judge against RESEARCH_RUBRIC.
 */
export interface ResearchDossier {
  /** The Idea this dossier researches (FK target, not enforced here). */
  ideaId: string
  /** The research question the agent actually searched. */
  query: string
  /** Synthesized overview the agent wrote across its searches. */
  summary: string
  /** Curated, de-duplicated sources. */
  sources: DossierSource[]
  /** Total server-side web searches billed across all iterations. */
  searchCount: number
}

/**
 * Everything the Stage 2 agents need about the Idea + Persona, decoupled
 * from Prisma rows so the agents stay pure and testable. The CLI maps DB
 * rows into this shape.
 */
export interface ResearchContext {
  ideaId: string
  ideaTitle: string
  ideaDescription: string
  niches: string[]
  /** Short, human-readable description of who this content is for. */
  audienceSummary: string
}

/** Cost emitted by a Stage 2 unit (agent, curator, or judge). */
export interface ResearchCostEvent {
  source: 'research' | 'curator' | 'judge'
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}
