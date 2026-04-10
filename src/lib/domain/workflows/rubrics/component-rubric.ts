// Component Plan Quality Rubric — evaluates component selection and mapping
// Domain layer: imports RubricDefinition from core

import type { RubricDefinition } from '../../../core/engine/types'

export const COMPONENT_RUBRIC: RubricDefinition = {
  id: 'component-plan-v1',
  name: 'Component Plan Quality Rubric',
  passThreshold: 75,
  dimensions: [
    {
      id: 'coverage',
      name: 'Coverage',
      weight: 0.25,
      passThreshold: 70,
      description: 'Does every learning outcome have at least one component?',
      criteria: {
        excellent: 'Score 85-100 — Every learning outcome maps to at least one component. No outcome is left unaddressed, no component is orphaned.',
        good: 'Score 70-84 — Most outcomes have supporting components. One or two minor outcomes may lack explicit coverage.',
        adequate: 'Score 55-69 — Several outcomes lack dedicated components. Coverage gaps exist but core objectives are addressed.',
        poor: 'Score 0-54 — Many outcomes have no supporting components. Significant gaps between plan and learning goals.',
      },
    },
    {
      id: 'appropriateness',
      name: 'Appropriateness',
      weight: 0.20,
      passThreshold: 65,
      description: 'Are component types right for the audience and content?',
      criteria: {
        excellent: 'Score 85-100 — Component types match content complexity and audience preferences perfectly. Active learning is well-balanced with passive content.',
        good: 'Score 70-84 — Component types are generally appropriate. A few could be better matched to content or audience.',
        adequate: 'Score 55-69 — Some mismatches between component types and content. Over-reliance on one type (e.g., all videos).',
        poor: 'Score 0-54 — Component types are inappropriate for the audience or content. No variety or poor type selection.',
      },
    },
    {
      id: 'dependencies',
      name: 'Dependencies',
      weight: 0.15,
      passThreshold: 60,
      description: 'Are component dependencies valid and satisfied?',
      criteria: {
        excellent: 'Score 85-100 — All dependencies are explicitly declared, acyclic, and satisfiable. Production order is clear.',
        good: 'Score 70-84 — Dependencies are mostly declared. Minor implicit dependencies exist but are resolvable.',
        adequate: 'Score 55-69 — Some dependencies are missing or unclear. Production order requires manual intervention to determine.',
        poor: 'Score 0-54 — Dependencies are absent, circular, or contradictory. No viable production order exists.',
      },
    },
    {
      id: 'cost_feasibility',
      name: 'Cost Feasibility',
      weight: 0.20,
      passThreshold: 65,
      description: 'Is total cost within project budget constraints?',
      criteria: {
        excellent: 'Score 85-100 — Total estimated cost is well within budget with contingency margin. Per-component costs are itemized and justified.',
        good: 'Score 70-84 — Total cost is within budget. Most components have cost estimates, minor items may be approximated.',
        adequate: 'Score 55-69 — Cost is near budget limit with little margin. Several components lack cost estimates.',
        poor: 'Score 0-54 — Cost exceeds budget or is largely unestimated. No clear path to delivering within constraints.',
      },
    },
    {
      id: 'alignment',
      name: 'Alignment',
      weight: 0.20,
      passThreshold: 70,
      description: 'Does each component serve a specific learning outcome?',
      criteria: {
        excellent: 'Score 85-100 — Every component has an explicit link to one or more learning outcomes. The mapping is bidirectional and complete.',
        good: 'Score 70-84 — Most components are clearly linked to outcomes. A few supportive components lack explicit mapping.',
        adequate: 'Score 55-69 — Some components appear decorative or loosely connected to outcomes. Mapping is incomplete.',
        poor: 'Score 0-54 — Components and outcomes are largely disconnected. Plan looks assembled rather than designed.',
      },
    },
  ],
}
