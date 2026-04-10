/**
 * Structure Rubric — 7-dimension evaluation for Phase 0 project blueprints.
 *
 * Grades the quality of a project's hierarchical structure, learning outcomes,
 * component assignments, and overall design before production begins.
 * Conforms to docs/rubrics/structure-rubric-schema.json.
 */

import type { GradeRecommendation } from '../types'
import type { RubricDefinition } from '../../../core/engine/types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RubricDimension {
  id: string
  name: string
  weight: number
  passThreshold: number
  description: string
  criteria: {
    excellent: string
    good: string
    adequate: string
    poor: string
  }
}

export interface StructureRubric {
  name: string
  domain: string
  passThreshold: number
  maxRefinementLoops: number
  dimensions: RubricDimension[]
}

export interface ScoreResult {
  overallScore: number
  passesThreshold: boolean
  failingDimensions: string[]
}

// ─── Rubric Definition ─────────────────────────────────────────────────────

export const STRUCTURE_RUBRIC: StructureRubric = {
  name: 'Project Structure Quality Rubric',
  domain: 'elearn',
  passThreshold: 75,
  maxRefinementLoops: 5,
  dimensions: [
    {
      id: 'coverage',
      name: 'Coverage',
      weight: 0.18,
      passThreshold: 70,
      description: 'Do learning outcomes cover the full scope?',
      criteria: {
        excellent: 'Every topic and subtopic has measurable outcomes aligned to Bloom\'s taxonomy. No gaps between brief requirements and structure.',
        good: 'Most topics have clear outcomes. Minor gaps in coverage that don\'t affect core learning goals.',
        adequate: 'Outcomes exist but several topics lack specificity. Some brief requirements are only partially addressed.',
        poor: 'Large sections have no outcomes. Major gaps between what the brief asks for and what the structure delivers.',
      },
    },
    {
      id: 'depth',
      name: 'Depth',
      weight: 0.15,
      passThreshold: 65,
      description: 'Is the hierarchy deep enough for meaningful learning?',
      criteria: {
        excellent: 'Hierarchy depth matches content complexity. Each level adds meaningful granularity without over-splitting.',
        good: 'Depth is appropriate for most sections. A few areas could benefit from more or less granularity.',
        adequate: 'Some sections are too shallow (lumping unrelated concepts) or too deep (splitting unnecessarily).',
        poor: 'Hierarchy is flat with no meaningful subdivision, or excessively nested with redundant levels.',
      },
    },
    {
      id: 'progression',
      name: 'Progression',
      weight: 0.18,
      passThreshold: 75,
      description: 'Do topics build logically on each other?',
      criteria: {
        excellent: 'Clear prerequisite chain. Each topic builds on prior knowledge. Bloom levels progress from remember to create.',
        good: 'Logical flow with minor ordering issues. Most prerequisites are respected.',
        adequate: 'General flow exists but some topics appear out of sequence. Bloom progression is inconsistent.',
        poor: 'No discernible learning progression. Advanced topics appear before foundational concepts.',
      },
    },
    {
      id: 'balance',
      name: 'Balance',
      weight: 0.12,
      passThreshold: 65,
      description: 'Are modules roughly similar in scope and complexity?',
      criteria: {
        excellent: 'Modules are comparable in scope, estimated duration, and cognitive demand. No outliers.',
        good: 'Most modules are balanced. One or two are noticeably larger or smaller but justified.',
        adequate: 'Significant variation in module size. Some modules are 3x+ larger than others without clear justification.',
        poor: 'Wildly unbalanced. Some modules have dozens of topics while others have one or two.',
      },
    },
    {
      id: 'engagement',
      name: 'Engagement',
      weight: 0.15,
      passThreshold: 70,
      description: 'Are there enough activities, not just passive content?',
      criteria: {
        excellent: 'Rich mix of videos, activities, assessments, and discussions. Active learning at every level.',
        good: 'Good variety of component types. Most nodes have both passive and active elements.',
        adequate: 'Predominantly passive content (videos, reading). Few activities or assessments.',
        poor: 'Almost entirely passive. No activities, minimal assessment. Learners just watch and read.',
      },
    },
    {
      id: 'feasibility',
      name: 'Feasibility',
      weight: 0.10,
      passThreshold: 60,
      description: 'Is scope realistic for timeline and budget?',
      criteria: {
        excellent: 'Scope, component count, and complexity are well within budget and timeline estimates.',
        good: 'Scope is achievable with minor adjustments. Estimated costs are within 10% of budget.',
        adequate: 'Scope is ambitious. May require timeline extension or component reduction to deliver.',
        poor: 'Scope is unrealistic. Component count or complexity far exceeds available resources.',
      },
    },
    {
      id: 'coherence',
      name: 'Coherence',
      weight: 0.12,
      passThreshold: 70,
      description: 'Does every component serve a learning outcome?',
      criteria: {
        excellent: 'Every component maps to one or more learning outcomes. No orphan components. No unaddressed outcomes.',
        good: 'Strong component-to-outcome mapping. A few components lack explicit outcome links but are clearly supportive.',
        adequate: 'Some components seem decorative — not clearly tied to outcomes. Some outcomes lack supporting components.',
        poor: 'Components and outcomes are disconnected. Structure looks assembled rather than designed.',
      },
    },
  ],
}

// ─── Core-compatible export ───────────────────────────────────────────────

export const STRUCTURE_RUBRIC_DEFINITION: RubricDefinition = {
  id: 'structure-quality-v1',
  name: STRUCTURE_RUBRIC.name,
  passThreshold: STRUCTURE_RUBRIC.passThreshold,
  dimensions: STRUCTURE_RUBRIC.dimensions.map(d => ({
    id: d.id,
    name: d.name,
    weight: d.weight,
    passThreshold: d.passThreshold,
    description: d.description,
    criteria: d.criteria,
  })),
}

// ─── Scoring Functions ─────────────────────────────────────────────────────

/** Calculate the weighted overall score and identify failing dimensions. */
export function calculateOverallScore(
  dimensionScores: { dimensionId: string; score: number }[]
): ScoreResult {
  const dimensions = STRUCTURE_RUBRIC.dimensions
  let overallScore = 0
  const failingDimensions: string[] = []

  for (const dim of dimensions) {
    const entry = dimensionScores.find(s => s.dimensionId === dim.id)
    const score = entry?.score ?? 0
    overallScore += score * dim.weight

    if (score < dim.passThreshold) {
      failingDimensions.push(dim.id)
    }
  }

  overallScore = Math.round(overallScore * 100) / 100

  return {
    overallScore,
    passesThreshold: overallScore >= STRUCTURE_RUBRIC.passThreshold && failingDimensions.length === 0,
    failingDimensions,
  }
}

/** Map an overall score + failing dimensions to a recommendation. */
export function getRecommendation(
  overallScore: number,
  failingDimensions: string[]
): GradeRecommendation {
  if (overallScore >= 85 && failingDimensions.length === 0) return 'approve'
  if (overallScore >= 75 && failingDimensions.length <= 1) return 'revise'
  if (overallScore >= 60) return 'restructure'
  return 'reject'
}
