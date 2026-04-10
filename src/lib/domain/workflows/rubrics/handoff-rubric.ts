// Handoff Readiness Rubric — final gate before production begins
// Domain layer: imports RubricDefinition from core
// Higher passThreshold (80) because this is the last checkpoint.

import type { RubricDefinition } from '../../../core/engine/types'

export const HANDOFF_RUBRIC: RubricDefinition = {
  id: 'handoff-readiness-v1',
  name: 'Handoff Readiness Rubric',
  passThreshold: 80,
  dimensions: [
    {
      id: 'config_completeness',
      name: 'Config Completeness',
      weight: 0.25,
      passThreshold: 75,
      description: 'Are all component configs fully specified?',
      criteria: {
        excellent: 'Score 85-100 — Every component has a complete configuration with all required fields populated. No placeholders or TBDs remain.',
        good: 'Score 70-84 — Most configs are complete. A few non-critical fields may have placeholder values.',
        adequate: 'Score 55-69 — Configs exist but several have incomplete fields. Some components need additional specification.',
        poor: 'Score 0-54 — Many components lack configs or have mostly placeholder values. Not ready for production.',
      },
    },
    {
      id: 'cost_validation',
      name: 'Cost Validation',
      weight: 0.20,
      passThreshold: 70,
      description: 'Is cost estimate within budget? Are there surprises?',
      criteria: {
        excellent: 'Score 85-100 — Final cost estimate is within budget with itemized breakdown. No hidden costs. Contingency is allocated.',
        good: 'Score 70-84 — Cost is within budget. Breakdown exists but a few line items are estimated rather than confirmed.',
        adequate: 'Score 55-69 — Cost is near budget limit. Some components lack cost estimates, introducing uncertainty.',
        poor: 'Score 0-54 — Cost exceeds budget, is poorly estimated, or has significant unknowns that could blow up in production.',
      },
    },
    {
      id: 'timeline',
      name: 'Timeline',
      weight: 0.15,
      passThreshold: 65,
      description: 'Is production timeline realistic for scope?',
      criteria: {
        excellent: 'Score 85-100 — Timeline accounts for all production phases with buffer. Dependencies are sequenced. Critical path is identified.',
        good: 'Score 70-84 — Timeline is realistic with minor optimism in a few areas. Most dependencies are accounted for.',
        adequate: 'Score 55-69 — Timeline exists but is tight. Some phases are underestimated or dependencies are not fully mapped.',
        poor: 'Score 0-54 — Timeline is unrealistic, missing, or ignores production complexity. Delivery date is not credible.',
      },
    },
    {
      id: 'missing_items',
      name: 'Missing Items',
      weight: 0.20,
      passThreshold: 70,
      description: 'Are there any gaps — missing outcomes, unconfigured components?',
      criteria: {
        excellent: 'Score 85-100 — Completeness audit shows zero gaps. Every outcome has components, every component has config, every dependency is satisfied.',
        good: 'Score 70-84 — Minor gaps exist but are documented with resolution plans. Nothing blocks production start.',
        adequate: 'Score 55-69 — Several gaps identified. Some outcomes lack components or some components lack full configuration.',
        poor: 'Score 0-54 — Major gaps throughout. Missing outcomes, unconfigured components, or unresolved dependencies.',
      },
    },
    {
      id: 'quality',
      name: 'Quality',
      weight: 0.20,
      passThreshold: 70,
      description: 'Does the overall blueprint meet quality standards?',
      criteria: {
        excellent: 'Score 85-100 — Blueprint is production-ready. Structure is sound, components are well-chosen, and the plan inspires confidence.',
        good: 'Score 70-84 — Blueprint is solid with minor rough edges. Quality is sufficient to begin production.',
        adequate: 'Score 55-69 — Blueprint has quality concerns. Some sections feel rushed or under-developed.',
        poor: 'Score 0-54 — Blueprint quality is poor. Structure, component selection, or overall design needs significant rework.',
      },
    },
  ],
}
