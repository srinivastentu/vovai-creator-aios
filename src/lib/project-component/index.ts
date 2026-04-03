/**
 * Project Component Layer — Barrel Export
 *
 * Single import point for all UI-facing types, registries, and utilities.
 * Usage: import { ProjectNodeType, buildTree, STRUCTURE_RUBRIC } from '@/lib/project-component'
 *
 * Internal-only exports (agent framework, executor) are NOT re-exported here.
 */

// ─── Types (all enums, unions, interfaces) ──────────────────────────────────

export type {
  // Enums & unions
  ProjectArchetype,
  BloomLevel,
  IdeationPhase,
  ComponentCategory,
  ProductionMode,
  NodeStatus,
  ComponentStatus,
  ComponentPriority,
  BrainstormRole,
  GradeRecommendation,
  IdeationMessageKind,
  PhaseAction,
  // Generic
  TreeNode,
  // Domain interfaces
  LearningOutcome,
  AudienceProfile,
  ProposedTopic,
  ProposedModule,
  AlternativeStructure,
  ProposedStructure,
  ProjectNodeType,
  AttachedComponentType,
  ProjectBlueprintType,
  ComponentDefinition,
  ArchetypeDefinition,
  LevelComponentDefaults,
  WorkflowTemplate,
  DimensionGradeScore,
  GradeReport,
  NodeOutcomes,
  OutcomesMap,
  ComponentRecommendation,
  NodeComponentRecommendation,
  BudgetTier,
  ComponentPlan,
  OptimizationIssue,
  OptimizationReport,
  Challenge,
  DevilsAdvocateReport,
  OrchestratorOutput,
  IdeationMessageType,
  BlueprintSummary,
} from './types'

// ─── Registries ─────────────────────────────────────────────────────────────

export {
  PROJECT_ARCHETYPES,
  getArchetype,
  listArchetypes,
} from './archetypes'

export {
  COMPONENT_REGISTRY,
  getComponent,
  listComponents,
  getComponentsForLevel,
} from './component-registry'

export type { CompatibilityEntry } from './compatibility'
export {
  COMPONENT_COMPATIBILITY,
  getCompatibleComponents,
  isComponentAvailable,
} from './compatibility'

// ─── Workflow Defaults ──────────────────────────────────────────────────────

export {
  PIPELINE_PHASE_ORDER,
  buildDefaultWorkflowTemplate,
  getRecommendedProductionOrder,
  validateDependencyOrder,
} from './workflow-defaults'

// ─── Rubric ─────────────────────────────────────────────────────────────────

export type {
  RubricDimension,
  StructureRubric,
  ScoreResult,
} from './rubrics/structure-rubric'

export {
  STRUCTURE_RUBRIC,
  calculateOverallScore,
  getRecommendation,
} from './rubrics/structure-rubric'

// ─── Tree Utilities ─────────────────────────────────────────────────────────

export type { TreeStats } from './tree/tree-utils'
export {
  buildTree,
  flattenTree,
  findNode,
  getAncestors,
  getDescendants,
  getSiblings,
  addNode,
  removeNode,
  moveNode,
  updatePaths,
  getTreeStats,
} from './tree/tree-utils'

export type {
  ValidationErrorCode,
  ValidationError,
  ValidationResult,
} from './tree/tree-validator'
export { validateTree } from './tree/tree-validator'

export type {
  BlueprintSnapshot,
  SerializedBlueprint,
  SerializedNode,
  SerializedComponent,
} from './tree/tree-serializer'
export {
  serializeBlueprint,
  deserializeBlueprint,
} from './tree/tree-serializer'

// ─── Production (cost estimator only — client-safe) ─────────────────────────

export type {
  CostRange,
  PhaseCostEstimate,
  TypeCostEstimate,
  CostEstimate,
} from './production/cost-estimator'

export { estimateProjectCost } from './production/cost-estimator'

// ─── Ideation (phase manager only — client-safe, no db imports) ─────────────

export type {
  HumanFeedbackEntry,
  BlueprintVersion,
  IdeationLoopState,
} from './ideation/phase-manager'

export {
  PHASE_TRANSITIONS,
  canTransition,
  getNextPhase,
  createInitialState,
} from './ideation/phase-manager'

// ─── Server-only exports live in ./server.ts ────────────────────────────────
// executeHandoff, HandoffError, conversation-manager, loop-engine
// Import from '@/lib/project-component/server' in API routes.
