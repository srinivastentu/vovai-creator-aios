// RESEARCH_RUBRIC — Stage 2 (Research).
// Domain configuration: grades a ResearchDossier. Per docs/02-domain/rubrics.md.
//
// Scoring model (rubrics.md Rule 4): the judge scores each dimension 1–10;
// the composite is Σ(score · weight · 10) → a 0–100 score. Threshold 75.
// Dimension pass bars are on the 1–10 scale.

import type { RubricDefinition } from '../../../../core/engine/types'

/** Anchor descriptions keyed by 1–10 score level. */
const anchors = (low: string, four: string, seven: string, nine: string) => ({
  '1': low,
  '4': four,
  '7': seven,
  '9': nine,
})

export const RESEARCH_RUBRIC: RubricDefinition = {
  id: 'research-rubric',
  name: 'Research Dossier Quality (5-dimension)',
  passThreshold: 75,
  dimensions: [
    {
      id: 'relevance',
      name: 'Relevance',
      weight: 0.2,
      passThreshold: 7,
      description:
        'Sources are about the idea itself, not adjacent or tangential topics.',
      criteria: anchors(
        'Sources are off-topic or only loosely related to the idea.',
        'Some sources are relevant; several drift into adjacent territory.',
        'Most sources directly address the idea; little drift.',
        'Every source is squarely on the idea and pulls a distinct, useful thread.'
      ),
    },
    {
      id: 'coverage',
      name: 'Coverage',
      weight: 0.2,
      passThreshold: 7,
      description:
        'Multiple facets of the idea are represented — not one angle repeated.',
      criteria: anchors(
        'Single narrow angle; large parts of the idea are unexamined.',
        'A couple of facets covered; obvious gaps remain.',
        'The main facets of the idea are each represented by at least one source.',
        'Comprehensive: competing viewpoints, mechanisms, and implications all covered.'
      ),
    },
    {
      id: 'sourceQuality',
      name: 'Source Quality',
      weight: 0.2,
      passThreshold: 7,
      description:
        'Sources are authoritative — primary research, recognized publications, practitioners — not SEO filler.',
      criteria: anchors(
        'Mostly content-farm or anonymous low-trust pages.',
        'Mixed: a few credible sources amid generic blogs.',
        'Predominantly credible: docs, reputable outlets, named experts.',
        'Strong primary/authoritative sources throughout; each is defensible.'
      ),
    },
    {
      id: 'factualGrounding',
      name: 'Factual Grounding',
      weight: 0.2,
      passThreshold: 7,
      description:
        'Claims in snippets/summary are supported by the cited source, not invented.',
      criteria: anchors(
        'Summary makes claims with no traceable support; possible fabrication.',
        'Some claims supported; others float free of any source.',
        'Most claims map to a specific source snippet.',
        'Every substantive claim is anchored to a source the reader could verify.'
      ),
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.2,
      passThreshold: 7,
      description:
        'At least 3 curated sources after dedupe; all URLs well-formed; summary is whole.',
      criteria: anchors(
        'Fewer than 3 usable sources, malformed URLs, or a truncated summary.',
        'Exactly 3 thin sources or a summary that stops short.',
        '3+ solid sources with valid URLs and a complete summary.',
        '8+ distinct high-value sources with a thorough, self-contained summary.'
      ),
    },
  ],
}

/** Structural self-check for RESEARCH_RUBRIC (weights sum to 1.0; completeness ≥ 0.20). */
export function validateResearchRubric(
  rubric: RubricDefinition = RESEARCH_RUBRIC
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const sum = rubric.dimensions.reduce((s, d) => s + d.weight, 0)
  if (Math.abs(sum - 1) > 0.001) errors.push(`weights sum to ${sum}, expected 1`)
  const completeness = rubric.dimensions.find((d) => d.id === 'completeness')
  if (!completeness) errors.push('missing completeness dimension')
  else if (completeness.weight < 0.2)
    errors.push(`completeness weight ${completeness.weight} < 0.20`)
  return { valid: errors.length === 0, errors }
}
