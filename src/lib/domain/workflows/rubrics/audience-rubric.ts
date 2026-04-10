// Audience Profile Quality Rubric — evaluates learner audience analysis
// Domain layer: imports RubricDefinition from core

import type { RubricDefinition } from '../../../core/engine/types'

export const AUDIENCE_RUBRIC: RubricDefinition = {
  id: 'audience-profile-v1',
  name: 'Audience Profile Quality Rubric',
  passThreshold: 75,
  dimensions: [
    {
      id: 'specificity',
      name: 'Specificity',
      weight: 0.25,
      passThreshold: 70,
      description: 'Is the audience described with enough detail to act on?',
      criteria: {
        excellent: 'Score 85-100 — Audience segments are named with demographics, job roles, experience levels, and learning preferences. Personas are vivid and actionable.',
        good: 'Score 70-84 — Audience is well-described with most key attributes. A few segments could use more detail.',
        adequate: 'Score 55-69 — Audience description is broad. Uses general categories without distinguishing sub-segments.',
        poor: 'Score 0-54 — Audience is described generically ("professionals", "students") with no meaningful differentiation.',
      },
    },
    {
      id: 'actionability',
      name: 'Actionability',
      weight: 0.20,
      passThreshold: 65,
      description: 'Can content decisions be made from this profile alone?',
      criteria: {
        excellent: 'Score 85-100 — Profile alone is sufficient to make every content, pacing, and assessment decision. No further audience research needed.',
        good: 'Score 70-84 — Most content decisions can be made from the profile. A few areas may need minor clarification.',
        adequate: 'Score 55-69 — Profile provides general direction but many content decisions require additional assumptions.',
        poor: 'Score 0-54 — Profile is too generic to inform content decisions. Could describe almost any audience.',
      },
    },
    {
      id: 'prerequisites',
      name: 'Prerequisites',
      weight: 0.15,
      passThreshold: 60,
      description: 'Are assumed skills and knowledge clearly stated?',
      criteria: {
        excellent: 'Score 85-100 — Prerequisites list specific skills, tools, and knowledge with proficiency levels. Entry requirements are unambiguous.',
        good: 'Score 70-84 — Prerequisites are listed with reasonable specificity. Most assumed knowledge is documented.',
        adequate: 'Score 55-69 — Some prerequisites mentioned but gaps exist. Assumed knowledge is partially documented.',
        poor: 'Score 0-54 — Prerequisites are absent or so vague ("basic computer skills") they provide no guidance.',
      },
    },
    {
      id: 'motivation',
      name: 'Motivation',
      weight: 0.20,
      passThreshold: 65,
      description: 'Are learner motivations, goals, and pain points captured?',
      criteria: {
        excellent: 'Score 85-100 — Motivations, career goals, pain points, and barriers to learning are explicitly documented with evidence or research backing.',
        good: 'Score 70-84 — Motivations and goals are clearly stated. Pain points are mentioned but could be more specific.',
        adequate: 'Score 55-69 — General motivations noted but lack depth. Pain points are assumed rather than researched.',
        poor: 'Score 0-54 — No mention of why learners would take this course or what problems they face.',
      },
    },
    {
      id: 'context',
      name: 'Context',
      weight: 0.20,
      passThreshold: 65,
      description: 'Is learning context described (environment, device, time)?',
      criteria: {
        excellent: 'Score 85-100 — Learning environment, devices, available time, connectivity, and accessibility needs are all documented.',
        good: 'Score 70-84 — Most contextual factors are addressed. One or two assumptions are unstated.',
        adequate: 'Score 55-69 — Some context provided but major factors (device, time availability) are missing.',
        poor: 'Score 0-54 — No contextual information. Nothing about where, when, or how learners will access content.',
      },
    },
  ],
}
