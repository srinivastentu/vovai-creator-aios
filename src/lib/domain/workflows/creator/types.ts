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

// ---------------------------------------------------------------------------
// Stage 3 (Long-Form Master synthesis) artifacts.
// The Research Dossier (Stage 2) flows in; a structured, source-traceable
// LongFormMaster flows out toward Gate A. These are CreatorOS-specific shapes
// — not Core. A Film AIOS would structure its master differently.
// ---------------------------------------------------------------------------

/**
 * One source available to the synthesizer, already persisted as a
 * ResearchSource row in CR-2. `researchSourceId` is the DB id the synthesizer
 * must cite against; the synthesizer references sources by short stable
 * handles (S1, S2, …) which the agent maps back to these ids in code.
 */
export interface MasterSourceInput {
  researchSourceId: string
  url: string
  title: string
  snippet: string
}

/** A section's citation: links section → ResearchSource with a relevance excerpt. */
export interface MasterSourceRef {
  researchSourceId: string
  relevanceSnippet: string
}

/** One ordered section of a Long-Form Master. */
export interface MasterSection {
  order: number
  heading: string
  contentMarkdown: string
  /** Every section cites ≥1 source (Gate A traceability). */
  sourceRefs: MasterSourceRef[]
}

/**
 * Stage 3 output (the loop's artifact T). Self-contained: it carries the
 * source pool it was built against so the deterministic validator and the
 * cross-model judge stay pure `(artifact) => …` functions — mirroring how a
 * ResearchDossier carries its own sources. The `sources` snapshot is
 * loop-internal; only `title` + `sections` are persisted (ResearchSource rows
 * already exist from CR-2).
 */
export interface MasterArtifact {
  title: string
  sections: MasterSection[]
  sources: MasterSourceInput[]
}

/**
 * Compact persona view the synthesizer writes toward and the judge grades
 * `personaAlignment` against. Rendered from the CreatorPersona JSON columns
 * by the CLI (see docs/02-domain/buildos-persona.md for the sub-schemas).
 */
export interface MasterPersona {
  name: string
  /** Formality + vocabulary + cadence, one block. */
  voiceSummary: string
  /** The recurring thesis every piece ladders up to. */
  pointOfView: string
  /** Who this content is for. */
  audienceSummary: string
  /** Banned words/phrases (AI tells, hype). */
  doNotSay: string[]
}

/**
 * Everything the synthesizer needs about the Master-in-progress, decoupled
 * from Prisma rows so the agent stays pure and testable. The CLI maps DB rows
 * into this shape.
 */
export interface MasterContext {
  longFormMasterId: string
  ideaTitle: string
  ideaDescription: string
  niches: string[]
  persona: MasterPersona
  /** The curated dossier sources (ResearchSource rows from CR-2). */
  sources: MasterSourceInput[]
  /** V1: empty (no uploads wired yet). Priority hint = 6 (see context-system.md). */
  uploadedDocs?: { title: string; content: string }[]
}

/** Cost emitted by a Stage 3 unit (synthesizer or judge). */
export interface MasterCostEvent {
  source: 'synthesizer' | 'judge'
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

// ---------------------------------------------------------------------------
// Stage 5 (Repurpose) artifacts — CR-4 single-model producers.
// An approved Long-Form Master flows in; one publishable artifact per type
// flows out toward Gate B. CR-4 runs ONE Claude producer per type (no judge,
// no cross-critique). CR-7 swaps the stage to the Cross-Critique pattern with
// two producers + critics + integrator + Gemini judge. These are CreatorOS-
// specific shapes — not Core.
// ---------------------------------------------------------------------------

/** V1 repurpose targets (Artifact.artifactType). */
export type ArtifactKind = 'linkedin_post' | 'long_form_article'

/**
 * One Long-Form Master section the producer repurposes. Unlike a MasterSection
 * this carries no sourceRefs — the published post/article does not cite inline;
 * the Master holds the traceable citations (Gate A), the artifact is the
 * publishable surface.
 */
export interface RepurposeSection {
  heading: string
  contentMarkdown: string
}

/**
 * Compact persona view the producers write toward. Rendered from the
 * CreatorPersona JSON columns by the CLI (see docs/02-domain/buildos-persona.md).
 * Carries the voice fingerprints the producer must apply — the voice-fidelity
 * criterion of the V1 acceptance test bites from CR-4 onward.
 */
export interface ProducerPersona {
  name: string
  /** Formality + vocabulary + cadence, one block. */
  voiceSummary: string
  /** The recurring thesis every piece ladders up to. */
  pointOfView: string
  /** Who this content is for. */
  audienceSummary: string
  /** Phrases the voice reaches for (apply, don't force). */
  signaturePhrases: string[]
  /** Recurring opening moves the creator uses. */
  signatureHooks: string[]
  /** Banned words/phrases (AI tells, hype). */
  doNotSay: string[]
}

/**
 * Everything a Stage 5 producer needs about the Master + Persona, decoupled
 * from Prisma rows so the agent stays pure and testable. The CLI maps DB rows
 * into this shape.
 */
export interface RepurposeContext {
  longFormMasterId: string
  artifactType: ArtifactKind
  masterTitle: string
  ideaTitle: string
  niches: string[]
  persona: ProducerPersona
  /** The approved Master's ordered sections (heading + body). */
  sections: RepurposeSection[]
  /**
   * Curated persona + Long-Form Master block, assembled once by the Core
   * ContextCurator (System 6) before the cross-critique loop (CR-8). Producers
   * read it verbatim; when absent (direct unit-test calls) the producer builder
   * renders persona+master inline via defaultProducerContext. Under the V1
   * PassthroughCurator budget nothing is dropped, so this block equals that inline
   * fallback — the field is the architectural seam, not a behaviour change.
   */
  curatedContextBlock?: string
}

/** Artifact.content for `linkedin_post`. charCount is recomputed from text by code. */
export interface LinkedInArtifact {
  text: string
  charCount: number
}

/** Artifact.content for `long_form_article`. wordCount is recomputed from markdown by code. */
export interface ArticleArtifact {
  title: string
  markdown: string
  wordCount: number
}

/** Loop artifact T for a Stage 5 producer stage (one concrete type per stage). */
export type RepurposeArtifact = LinkedInArtifact | ArticleArtifact

/**
 * Cost emitted by a Stage 5 unit. CR-5 adds the Gemini judge (`'judge'`);
 * CR-7 adds the cross-critique critics + integrator.
 */
export interface RepurposeCostEvent {
  source: 'producer' | 'judge'
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}
