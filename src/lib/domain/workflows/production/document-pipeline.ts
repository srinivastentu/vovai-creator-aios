// Document Pipeline Config — LE-12
// Proves engine universality: SAME core engine, DIFFERENT domain config.
// Uses 1-10 scale (vs ideation's 0-100). Threshold 7 (vs ideation's 75).
// DOMAIN layer: imports from core/engine (types) and domain/workflows.

import type { AgentConfig, RubricDefinition } from '../../../core/engine/types'
import type { StageConfig, IdeationPipeline } from '../pipeline-orchestrator'
import { createPipeline } from '../pipeline-orchestrator'

// ---------------------------------------------------------------------------
// Shared agent config for document stages (stub — proving engine, not agents)
// ---------------------------------------------------------------------------

const DOC_AGENT: AgentConfig = {
  id: 'doc-agent',
  name: 'Document Agent',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: 30_000,
}

// ---------------------------------------------------------------------------
// 5 Document Rubrics — 1-10 scale, threshold 7
// ---------------------------------------------------------------------------

export const DOC_RESEARCH_RUBRIC: RubricDefinition = {
  id: 'doc-research-v1',
  name: 'Document Research Quality Rubric',
  passThreshold: 7,
  dimensions: [
    {
      id: 'accuracy',
      name: 'Accuracy',
      weight: 0.40,
      passThreshold: 7,
      description: 'Are facts and sources correct?',
      criteria: {
        excellent: 'Score 9-10 — All facts verified, multiple authoritative sources cited, no errors.',
        good: 'Score 7-8 — Facts are correct with minor gaps in sourcing.',
        adequate: 'Score 5-6 — Some facts unverified, limited sources.',
        poor: 'Score 1-4 — Significant factual errors or no sources.',
      },
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.35,
      passThreshold: 7,
      description: 'Does research cover all key areas?',
      criteria: {
        excellent: 'Score 9-10 — All key areas thoroughly researched with no gaps.',
        good: 'Score 7-8 — Most areas covered, minor gaps in peripheral topics.',
        adequate: 'Score 5-6 — Core areas covered but several gaps remain.',
        poor: 'Score 1-4 — Major areas missing or superficially covered.',
      },
    },
    {
      id: 'relevance',
      name: 'Relevance',
      weight: 0.25,
      passThreshold: 6,
      description: 'Is the research relevant to the document topic?',
      criteria: {
        excellent: 'Score 9-10 — Every source directly supports the document goals.',
        good: 'Score 7-8 — Most research is directly relevant with minor tangents.',
        adequate: 'Score 5-6 — Mix of relevant and tangential material.',
        poor: 'Score 1-4 — Research is largely off-topic or unfocused.',
      },
    },
  ],
}

export const DOC_CONTENT_RUBRIC: RubricDefinition = {
  id: 'doc-content-v1',
  name: 'Document Content Quality Rubric',
  passThreshold: 7,
  dimensions: [
    {
      id: 'clarity',
      name: 'Clarity',
      weight: 0.35,
      passThreshold: 7,
      description: 'Is the writing clear and understandable?',
      criteria: {
        excellent: 'Score 9-10 — Crystal clear prose, no ambiguity, accessible to target audience.',
        good: 'Score 7-8 — Clear writing with minor ambiguities.',
        adequate: 'Score 5-6 — Understandable but requires re-reading in places.',
        poor: 'Score 1-4 — Confusing, jargon-heavy, or poorly structured sentences.',
      },
    },
    {
      id: 'depth',
      name: 'Depth',
      weight: 0.35,
      passThreshold: 7,
      description: 'Does content cover topics with sufficient depth?',
      criteria: {
        excellent: 'Score 9-10 — Topics explored thoroughly with examples and evidence.',
        good: 'Score 7-8 — Good depth on core topics, lighter on supporting material.',
        adequate: 'Score 5-6 — Surface-level coverage of most topics.',
        poor: 'Score 1-4 — Shallow or missing coverage of key topics.',
      },
    },
    {
      id: 'engagement',
      name: 'Engagement',
      weight: 0.30,
      passThreshold: 6,
      description: 'Is the content engaging and well-paced?',
      criteria: {
        excellent: 'Score 9-10 — Compelling narrative, well-paced, holds reader attention.',
        good: 'Score 7-8 — Engaging with good flow, minor pacing issues.',
        adequate: 'Score 5-6 — Readable but dry or uneven pacing.',
        poor: 'Score 1-4 — Monotonous, poorly paced, loses reader interest.',
      },
    },
  ],
}

export const DOC_FORMAT_RUBRIC: RubricDefinition = {
  id: 'doc-format-v1',
  name: 'Document Format Quality Rubric',
  passThreshold: 7,
  dimensions: [
    {
      id: 'structure',
      name: 'Structure',
      weight: 0.40,
      passThreshold: 7,
      description: 'Is the document well-organized with clear hierarchy?',
      criteria: {
        excellent: 'Score 9-10 — Logical hierarchy, clear sections, intuitive navigation.',
        good: 'Score 7-8 — Well-organized with minor structural inconsistencies.',
        adequate: 'Score 5-6 — Basic organization but hierarchy is unclear in places.',
        poor: 'Score 1-4 — Disorganized, no clear structure or section hierarchy.',
      },
    },
    {
      id: 'visual_design',
      name: 'Visual Design',
      weight: 0.30,
      passThreshold: 7,
      description: 'Are visuals, typography, and layout effective?',
      criteria: {
        excellent: 'Score 9-10 — Professional layout, effective use of whitespace and typography.',
        good: 'Score 7-8 — Clean layout with minor visual inconsistencies.',
        adequate: 'Score 5-6 — Functional but visually plain or inconsistent.',
        poor: 'Score 1-4 — Poor layout, cramped text, no visual hierarchy.',
      },
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      weight: 0.30,
      passThreshold: 6,
      description: 'Is the document accessible (alt-text, contrast, readability)?',
      criteria: {
        excellent: 'Score 9-10 — Fully accessible: alt-text, good contrast, screen-reader friendly.',
        good: 'Score 7-8 — Mostly accessible with minor gaps.',
        adequate: 'Score 5-6 — Some accessibility features present but incomplete.',
        poor: 'Score 1-4 — No accessibility considerations.',
      },
    },
  ],
}

export const DOC_QA_RUBRIC: RubricDefinition = {
  id: 'doc-qa-v1',
  name: 'Document QA Rubric',
  passThreshold: 7,
  dimensions: [
    {
      id: 'accuracy',
      name: 'Accuracy',
      weight: 0.40,
      passThreshold: 7,
      description: 'Are all facts verified and correct?',
      criteria: {
        excellent: 'Score 9-10 — Zero errors found, all claims verified against sources.',
        good: 'Score 7-8 — No significant errors, minor typos or formatting issues.',
        adequate: 'Score 5-6 — A few factual errors or unverified claims.',
        poor: 'Score 1-4 — Multiple errors or unverified claims throughout.',
      },
    },
    {
      id: 'consistency',
      name: 'Consistency',
      weight: 0.35,
      passThreshold: 7,
      description: 'Is terminology and style consistent throughout?',
      criteria: {
        excellent: 'Score 9-10 — Perfectly consistent terminology, tone, and formatting.',
        good: 'Score 7-8 — Consistent with minor deviations.',
        adequate: 'Score 5-6 — Noticeable inconsistencies in terminology or style.',
        poor: 'Score 1-4 — Inconsistent terminology, mixed tones, formatting chaos.',
      },
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.25,
      passThreshold: 6,
      description: 'Are all sections complete with no gaps?',
      criteria: {
        excellent: 'Score 9-10 — Every section complete, no placeholders or TODOs.',
        good: 'Score 7-8 — All sections present, minor gaps in supplementary material.',
        adequate: 'Score 5-6 — Most sections complete but some have gaps.',
        poor: 'Score 1-4 — Incomplete sections, placeholders, or missing content.',
      },
    },
  ],
}

export const DOC_REVIEW_RUBRIC: RubricDefinition = {
  id: 'doc-review-v1',
  name: 'Document Final Review Rubric',
  passThreshold: 7,
  dimensions: [
    {
      id: 'readiness',
      name: 'Readiness',
      weight: 0.40,
      passThreshold: 7,
      description: 'Is the document ready for publication?',
      criteria: {
        excellent: 'Score 9-10 — Publication-ready, no further changes needed.',
        good: 'Score 7-8 — Ready with minor polish needed.',
        adequate: 'Score 5-6 — Needs another round of editing before publication.',
        poor: 'Score 1-4 — Not ready, significant issues remain.',
      },
    },
    {
      id: 'quality',
      name: 'Quality',
      weight: 0.35,
      passThreshold: 7,
      description: 'Does overall quality meet standards?',
      criteria: {
        excellent: 'Score 9-10 — Exceeds quality standards across all dimensions.',
        good: 'Score 7-8 — Meets quality standards with minor areas for improvement.',
        adequate: 'Score 5-6 — Below standards in some areas.',
        poor: 'Score 1-4 — Fails to meet minimum quality standards.',
      },
    },
    {
      id: 'alignment',
      name: 'Alignment',
      weight: 0.25,
      passThreshold: 6,
      description: 'Does the document align with the original brief?',
      criteria: {
        excellent: 'Score 9-10 — Perfectly aligned with brief objectives and scope.',
        good: 'Score 7-8 — Well-aligned with minor scope deviations.',
        adequate: 'Score 5-6 — Partially aligned, some objectives not addressed.',
        poor: 'Score 1-4 — Misaligned with brief, major objectives missed.',
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// 5 Document Pipeline Stages
// ---------------------------------------------------------------------------

export const DOCUMENT_PIPELINE_STAGES: StageConfig[] = [
  {
    id: 'd1-research',
    agents: [DOC_AGENT],
    rubric: DOC_RESEARCH_RUBRIC,
    threshold: 7,
    maxIterations: 3,
    minIterations: 1,
    loopPattern: 'standard',
    reviewerRoles: ['document_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'd2-content',
    agents: [DOC_AGENT],
    rubric: DOC_CONTENT_RUBRIC,
    threshold: 7,
    maxIterations: 3,
    minIterations: 2,
    loopPattern: 'standard',
    dependsOn: ['d1-research'],
    reviewerRoles: ['document_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'd3-format',
    agents: [DOC_AGENT],
    rubric: DOC_FORMAT_RUBRIC,
    threshold: 7,
    maxIterations: 2,
    minIterations: 1,
    loopPattern: 'standard',
    dependsOn: ['d2-content'],
    reviewerRoles: ['document_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'd4-qa',
    agents: [DOC_AGENT],
    rubric: DOC_QA_RUBRIC,
    threshold: 7,
    maxIterations: 2,
    minIterations: 1,
    loopPattern: 'standard',
    dependsOn: ['d3-format'],
    reviewerRoles: ['document_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'd5-review',
    agents: [DOC_AGENT],
    rubric: DOC_REVIEW_RUBRIC,
    threshold: 7,
    maxIterations: 1,
    minIterations: 1,
    loopPattern: 'standard',
    dependsOn: ['d1-research', 'd2-content', 'd3-format', 'd4-qa'],
    reviewerRoles: ['document_owner', 'editor'],
    reviewGateConfig: {
      allowedActions: ['approve', 'reject', 'feedback', 'use_segments', 'mix_produce'],
    },
  },
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDocumentPipeline(
  blueprintId: string,
  nodeId: string
): IdeationPipeline {
  return createPipeline(
    `doc-pipeline-${blueprintId}-${nodeId}`,
    blueprintId,
    DOCUMENT_PIPELINE_STAGES
  )
}
