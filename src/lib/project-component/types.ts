/**
 * Project Component Layer — Type System
 *
 * Independent types compatible with Prisma generated types.
 * These are the application-level types used throughout the
 * project component layer (Phase 0: ideation → structure → configuration).
 */

// ─── Enums & Union Types ────────────────────────────────────────────────────

/** Project archetype — determines hierarchy, defaults, and production mode */
export type ProjectArchetype =
  | 'k12_curriculum'
  | 'professional_training'
  | 'content_channel'

/** Bloom's taxonomy levels — ordered from lowest to highest cognitive demand */
export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create'

/** Phase of the ideation loop (Phase 0 state machine) */
export type IdeationPhase =
  | 'brainstorm'
  | 'structure'
  | 'refinement'
  | 'review'
  | 'approved'

/** Component category — groups component types for UI and pipeline routing */
export type ComponentCategory =
  | 'content'
  | 'assessment'
  | 'activity'
  | 'meta'

/** Production mode — how components are batched for production */
export type ProductionMode =
  | 'batch'
  | 'module_sequential'
  | 'rolling'

/** Node status — lifecycle of a project node */
export type NodeStatus =
  | 'draft'
  | 'ideating'
  | 'structured'
  | 'approved'
  | 'in_production'
  | 'completed'

/** Component status — lifecycle of an attached component */
export type ComponentStatus =
  | 'planned'
  | 'configured'
  | 'queued'
  | 'in_production'
  | 'completed'
  | 'skipped'

/** Component priority — how essential a component is to the node */
export type ComponentPriority =
  | 'core'
  | 'recommended'
  | 'optional'

/** Brainstorm role — who sent the ideation message */
export type BrainstormRole =
  | 'human'
  | 'facilitator'
  | 'researcher'
  | 'pedagogy_expert'
  | 'audience_analyst'
  | 'structure_architect'
  | 'creative_director'
  | 'critic'
  | 'synthesizer'

/** Grade recommendation — what the rubric grader suggests */
export type GradeRecommendation =
  | 'approve'
  | 'revise'
  | 'restructure'
  | 'reject'

/** Message type — what kind of ideation message this is */
export type IdeationMessageKind =
  | 'text'
  | 'suggestion'
  | 'question'
  | 'decision'
  | 'structure_update'

// ─── Generic Utility Types ──────────────────────────────────────────────────

/** Generic tree node — any item with typed children */
export interface TreeNode<T> {
  data: T
  children: TreeNode<T>[]
}

// ─── Learning Outcomes ──────────────────────────────────────────────────────

/** A single measurable learning outcome attached to a node */
export interface LearningOutcome {
  id: string
  text: string
  bloomLevel: BloomLevel
  measurable: boolean
  assessmentComponentId?: string
  status: 'draft' | 'validated' | 'mapped'
}

// ─── Audience Profile ───────────────────────────────────────────────────────

/** Detailed audience analysis — stored as JSON on ProjectBlueprint.targetAudience */
export interface AudienceProfile {
  primaryAudience: {
    description: string
    ageRange?: string
    educationLevel: string
    professionalRole?: string
    experienceLevel: string
    learningContext: string
    motivations: string[]
    painPoints: string[]
    technologyComfort: 'beginner' | 'intermediate' | 'advanced'
  }
  prerequisiteKnowledge: string[]
  learningPreferences: {
    preferredModalities: string[]
    attentionSpan: 'short' | 'medium' | 'long'
    practicePreference: 'guided' | 'independent' | 'collaborative'
  }
}

// ─── Proposed Structure (Stage 0.2 output) ─────────────────────────────

/** A topic within a proposed module */
export interface ProposedTopic {
  title: string
  description: string
  keyConcepts: string[]
  estimatedMinutes: number
  subtopics?: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  bloomLevel: BloomLevel
}

/** A module within a proposed course structure */
export interface ProposedModule {
  title: string
  description: string
  topics: ProposedTopic[]
}

/** An alternative structure sketch (title + rationale only) */
export interface AlternativeStructure {
  title: string
  description: string
  rationale: string
  moduleCount: number
  tradeoffs: string
}

/** Full proposed course structure — output of the Curriculum Strategist agent */
export interface ProposedStructure {
  courseTitle: string
  courseDescription: string
  modules: ProposedModule[]
  sequencingRationale: string
  alternativeStructures: AlternativeStructure[]
  confidenceScore: number
}

// ─── Project Node ───────────────────────────────────────────────────────────

/** Full node shape including children for tree building */
export interface ProjectNodeType {
  id: string
  blueprintId: string
  parentId: string | null
  title: string
  slug: string
  description: string | null
  notes: string | null
  depth: number
  sortOrder: number
  learningOutcomes: LearningOutcome[]
  status: NodeStatus
  agentConfidence: number | null
  path: string
  createdAt: Date
  updatedAt: Date
  children: ProjectNodeType[]
  components: AttachedComponentType[]
}

// ─── Attached Component ─────────────────────────────────────────────────────

/** Component attached to a node — with config and scoring */
export interface AttachedComponentType {
  id: string
  nodeId: string
  componentType: string
  config: Record<string, unknown>
  priority: ComponentPriority
  status: ComponentStatus
  relevanceScore: number | null
  pipelineJobId: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Workflow Template ──────────────────────────────────────────────────────

/** Which components are enabled at a specific hierarchy depth */
export interface LevelComponentDefaults {
  depth: number
  label: string
  enabledComponents: string[]
}

/** Project-level production workflow — component selection, order, per-level defaults */
export interface WorkflowTemplate {
  enabledComponents: string[]
  productionOrder: string[]
  levelDefaults: LevelComponentDefaults[]
}

// ─── Project Blueprint ──────────────────────────────────────────────────────

/** Full blueprint shape with nodes array — the top-level project structure */
export interface ProjectBlueprintType {
  id: string
  projectId: string
  archetype: ProjectArchetype
  hierarchyLabels: Record<string, string>
  targetAudience: AudienceProfile
  learningOutcomes: LearningOutcome[]
  enabledComponents: string[]
  workflowTemplate: WorkflowTemplate | null
  ideationPhase: IdeationPhase
  ideationScore: number | null
  structureSummary: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  nodes: ProjectNodeType[]
}

// ─── Component Registry ─────────────────────────────────────────────────────

/** Registry entry for a component type — defines what it is and how it's built */
export interface ComponentDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: ComponentCategory
  deliverableType: string
  deliverableFormat: string[]
  pipelineType: 'document' | 'assessment' | 'video' | 'activity' | 'capstone' | 'meta'
  estimatedProductionTime: string
  estimatedCost: {
    min: number
    max: number
    currency: 'USD'
  }
  configSchema: Record<string, unknown>
  attachableAt: number[]
  maxPerNode: number
  required: boolean
  dependsOn: string[]
  produces: string[]
}

// ─── Archetype Registry ─────────────────────────────────────────────────────

/** Registry entry for a project archetype — defines structure and defaults */
export interface ArchetypeDefinition {
  id: ProjectArchetype
  name: string
  description: string
  hierarchy: Record<number, string>
  maxDepth: number
  defaultComponents: string[]
  availableComponents: string[]
  productionMode: ProductionMode
}

// ─── Grading ────────────────────────────────────────────────────────────────

/** Single dimension score within a structure grade */
export interface DimensionGradeScore {
  id: string
  name: string
  score: number
  weight: number
  passThreshold: number
  feedback: string
}

/** Full grade report — result of rubric evaluation on a blueprint structure */
export interface GradeReport {
  overallScore: number
  passesThreshold: boolean
  dimensionScores: DimensionGradeScore[]
  strengths: string[]
  weaknesses: string[]
  recommendation: GradeRecommendation
  specificImprovements: string[]
  feedback?: string | null
}

// ─── Outcomes Map (Stage 0.3 — Outcome Architect output) ───────────────────

/** Learning outcomes for a single node in the structure */
export interface NodeOutcomes {
  nodeTitle: string
  nodePath: string
  depth: number
  outcomes: LearningOutcome[]
  bloomDistribution: Record<BloomLevel, number>
}

/** Full outcomes map — all nodes with their outcomes + aggregate stats */
export interface OutcomesMap {
  courseOutcomes: LearningOutcome[]
  nodeOutcomes: NodeOutcomes[]
  totalOutcomes: number
  bloomDistribution: Record<BloomLevel, number>
  coverageNotes: string
}

// ─── Component Plan (Stage 0.3 — Component Recommender output) ─────────────

/** A single component recommendation for a node */
export interface ComponentRecommendation {
  componentType: string
  priority: ComponentPriority
  rationale: string
  estimatedCost: { min: number; max: number }
}

/** All component recommendations for a single node */
export interface NodeComponentRecommendation {
  nodeTitle: string
  nodePath: string
  depth: number
  components: ComponentRecommendation[]
}

/** A budget tier — essential, recommended, or comprehensive */
export interface BudgetTier {
  name: 'essential' | 'recommended' | 'comprehensive'
  description: string
  totalComponents: number
  estimatedCost: { min: number; max: number; currency: 'USD' }
  includedTypes: string[]
}

/** Full component plan — per-node recommendations + budget tiers */
export interface ComponentPlan {
  nodeRecommendations: NodeComponentRecommendation[]
  totalComponents: number
  componentBreakdown: Record<string, number>
  budgetTiers: BudgetTier[]
  rationale: string
}

// ─── Optimization Report (Stage 0.4 — Structure Optimizer output) ────────────

/** A single issue found by the Structure Optimizer */
export interface OptimizationIssue {
  type: 'balance' | 'gap' | 'redundancy' | 'sequencing' | 'depth' | 'component_mismatch'
  severity: 'critical' | 'warning' | 'suggestion'
  location: string
  description: string
  suggestedAction: string
}

/** Full optimization report — health score + categorized issues + actions */
export interface OptimizationReport {
  healthScore: number
  criticalIssues: OptimizationIssue[]
  warnings: OptimizationIssue[]
  suggestions: OptimizationIssue[]
  actions: string[]
  summary: string
}

// ─── Challenge (Stage 0.4 — Devil's Advocate output) ─────────────────────────

/** A single challenge raised by the Devil's Advocate */
export interface Challenge {
  assumption: string
  perspective: string
  severity: 'high' | 'medium' | 'low'
  concern: string
  suggestion: string
}

/** Full devil's advocate report */
export interface DevilsAdvocateReport {
  challenges: Challenge[]
  overallRiskLevel: 'high' | 'medium' | 'low'
  topConcerns: string[]
  summary: string
}

// ─── Orchestrator Output (Stage 0.1–0.7 — Orchestrator decision) ────────────

/** Phase action the orchestrator recommends */
export type PhaseAction =
  | 'continue'
  | 'advance_phase'
  | 'request_human_input'
  | 'trigger_grading'

/** Structured output from the Orchestrator agent */
export interface OrchestratorOutput {
  phaseAction: PhaseAction
  nextPhase?: IdeationPhase
  agentsToRun: string[]
  humanFacingMessage: string
  structuredProposal?: Record<string, unknown>
}

// ─── Ideation Messages ──────────────────────────────────────────────────────

/** A single message in an ideation conversation */
export interface IdeationMessageType {
  id: string
  conversationId: string
  role: BrainstormRole
  messageType: IdeationMessageKind
  content: string
  structuredData?: Record<string, unknown>
  createdAt: Date
}
