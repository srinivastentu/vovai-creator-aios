// Brief Quality Rubric — evaluates project brief clarity and completeness
// Domain layer: imports RubricDefinition from core

import type { RubricDefinition } from '../../../core/engine/types'

export const BRIEF_RUBRIC: RubricDefinition = {
  id: 'brief-quality-v1',
  name: 'Project Brief Quality Rubric',
  passThreshold: 75,
  dimensions: [
    {
      id: 'clarity',
      name: 'Clarity',
      weight: 0.25,
      passThreshold: 70,
      description: 'Is the brief unambiguous? Clear goals, no vague language?',
      criteria: {
        excellent: 'Score 85-100 — Goals, deliverables, and success criteria are unambiguous. No vague terms like "effective" or "appropriate" without measurable definition.',
        good: 'Score 70-84 — Goals are clear with minor ambiguities. Most deliverables are concretely defined.',
        adequate: 'Score 55-69 — Goals exist but contain vague language. Several deliverables lack concrete definition.',
        poor: 'Score 0-54 — Goals are unclear or missing. Deliverables are vaguely described or absent.',
      },
    },
    {
      id: 'specificity',
      name: 'Specificity',
      weight: 0.20,
      passThreshold: 65,
      description: 'Are deliverables, timeline, audience named concretely?',
      criteria: {
        excellent: 'Score 85-100 — Every deliverable has a concrete format, quantity, and deadline. Target audience is named with demographics and skill level.',
        good: 'Score 70-84 — Most deliverables are specific. Audience is described but a few details are assumed rather than stated.',
        adequate: 'Score 55-69 — Deliverables are listed but lack detail on format or quantity. Audience description is generic.',
        poor: 'Score 0-54 — Deliverables are vague or missing. Audience is described as "learners" or "users" with no further detail.',
      },
    },
    {
      id: 'scope',
      name: 'Scope',
      weight: 0.20,
      passThreshold: 65,
      description: 'Is scope realistic? Not too broad, not too narrow?',
      criteria: {
        excellent: 'Score 85-100 — Scope is well-bounded with explicit inclusions and exclusions. Achievable within stated constraints.',
        good: 'Score 70-84 — Scope is reasonable with minor boundary ambiguities. Mostly achievable as described.',
        adequate: 'Score 55-69 — Scope is either too broad (trying to cover everything) or too narrow (missing key areas). Needs refinement.',
        poor: 'Score 0-54 — Scope is undefined, wildly ambitious, or so narrow it cannot deliver meaningful learning outcomes.',
      },
    },
    {
      id: 'constraints',
      name: 'Constraints',
      weight: 0.15,
      passThreshold: 60,
      description: 'Are budget, timeline, technical limits stated?',
      criteria: {
        excellent: 'Score 85-100 — Budget, timeline, technical requirements, and platform constraints are all explicitly stated with specific values.',
        good: 'Score 70-84 — Most constraints are stated. One or two are implied rather than explicit.',
        adequate: 'Score 55-69 — Some constraints mentioned but several are missing. Budget or timeline may be vague ("ASAP", "reasonable budget").',
        poor: 'Score 0-54 — Constraints are largely absent. No budget, no timeline, no technical requirements specified.',
      },
    },
    {
      id: 'objectives',
      name: 'Objectives',
      weight: 0.20,
      passThreshold: 70,
      description: 'Are learning objectives measurable and outcome-focused?',
      criteria: {
        excellent: 'Score 85-100 — Every objective uses measurable action verbs (Bloom\'s taxonomy). Outcomes are specific, observable, and directly assessable.',
        good: 'Score 70-84 — Most objectives are measurable. A few use soft verbs like "understand" but are otherwise well-defined.',
        adequate: 'Score 55-69 — Objectives exist but many are vague ("understand", "learn about"). Few are directly assessable.',
        poor: 'Score 0-54 — Objectives are absent or entirely non-measurable. No clear indication of what learners will be able to do.',
      },
    },
  ],
}
