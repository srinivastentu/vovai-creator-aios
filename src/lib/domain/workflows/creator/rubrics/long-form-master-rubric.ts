// LONG_FORM_MASTER_RUBRIC — Stage 3 (Long-Form Master synthesis).
// Domain configuration: grades a MasterArtifact. Per docs/02-domain/rubrics.md.
//
// Scoring model (rubrics.md Rule 4): the judge scores each dimension 1–10;
// the composite is Σ(score · weight · 10) → a 0–100 score. Threshold 80 —
// this is the Gate A bar, deliberately higher than Stage 2's 75. Dimension
// pass bars are on the 1–10 scale.

import type { RubricDefinition } from '../../../../core/engine/types'

/** Anchor descriptions keyed by 1–10 score level. */
const anchors = (low: string, four: string, seven: string, nine: string) => ({
  '1': low,
  '4': four,
  '7': seven,
  '9': nine,
})

export const LONG_FORM_MASTER_RUBRIC: RubricDefinition = {
  id: 'long-form-master-rubric',
  name: 'Long-Form Master Quality (5-dimension)',
  passThreshold: 80,
  dimensions: [
    {
      id: 'comprehensiveness',
      name: 'Comprehensiveness',
      weight: 0.2,
      passThreshold: 8,
      description:
        'The idea is treated thoroughly — mechanisms, evidence, competing views, and implications, not one shallow pass.',
      criteria: anchors(
        'Surface-level; large parts of the idea are unexamined.',
        'Covers the obvious points; notable facets or counter-arguments missing.',
        'Treats the main facets of the idea, each with real substance.',
        'Thorough: mechanisms, evidence, tradeoffs, and implications all developed.'
      ),
    },
    {
      id: 'accuracy',
      name: 'Accuracy',
      weight: 0.2,
      passThreshold: 8,
      description:
        'Every claim in a section is supported by the source(s) that section cites — no drift, no invention.',
      criteria: anchors(
        'Claims contradict or have no basis in the cited sources; likely fabrication.',
        'Some claims supported; others overstate or stray from what the source says.',
        'Most claims are faithfully grounded in the cited source material.',
        'Every substantive claim is precisely supported by a cited source a reader could verify.'
      ),
    },
    {
      id: 'personaAlignment',
      name: 'Persona Alignment',
      weight: 0.2,
      passThreshold: 7,
      description:
        "Voice, register, and point of view match the creator persona; none of the persona's do-not-say tells appear.",
      criteria: anchors(
        'Generic encyclopedia voice; ignores the persona entirely or violates do-not-say rules.',
        'Occasionally on-voice but mostly neutral; persona POV not evident.',
        "Consistently in the persona's register and POV; no banned phrases.",
        "Unmistakably this persona — voice, stance, and audience-awareness throughout."
      ),
    },
    {
      id: 'traceabilityCompleteness',
      name: 'Traceability Completeness',
      weight: 0.2,
      passThreshold: 8,
      description:
        'Every section carries ≥1 SourceRef and each ref resolves to a real source in the dossier — Gate A is unbuildable otherwise.',
      criteria: anchors(
        'Sections cite nothing, or cite sources not in the dossier.',
        'Most sections cite something; at least one section is uncited or mis-cited.',
        'Every section cites ≥1 dossier source, and the citation is apt.',
        'Every section is densely and accurately traced; citations map tightly to claims.'
      ),
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.2,
      passThreshold: 7,
      description:
        '≥3 sections; ≥800 words total; nothing truncated mid-thought; the master reads as a finished whole.',
      criteria: anchors(
        'Fewer than 3 sections, under 800 words, or content cut off mid-sentence.',
        'Exactly the minimum, or a section that stops short of its point.',
        '3+ complete sections, ≥800 words, each section finishes its thought.',
        'Substantial and self-contained: well above the floor, no loose ends.'
      ),
    },
  ],
}

/** Structural self-check for LONG_FORM_MASTER_RUBRIC (weights sum to 1.0; completeness ≥ 0.20). */
export function validateLongFormMasterRubric(
  rubric: RubricDefinition = LONG_FORM_MASTER_RUBRIC
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
