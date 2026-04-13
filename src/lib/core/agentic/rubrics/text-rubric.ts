// 5-dimension text rubric on 1–10 scale.
// Domain-agnostic: belongs in core because it evaluates generic text quality.

import type { RubricDefinition } from '../../engine/types'

const anchors = (low: string, four: string, seven: string, eight: string, nine: string) => ({
  '1': low,
  '4': four,
  '7': seven,
  '8': eight,
  '9': nine,
})

export const TEXT_RUBRIC: RubricDefinition = {
  id: 'text-quality-v1',
  name: 'Text Quality (5-dimension)',
  passThreshold: 7,
  dimensions: [
    {
      id: 'clarity',
      name: 'Clarity & Readability',
      weight: 0.2,
      passThreshold: 6,
      description: 'Ideas are easy to follow; sentences are crisp; no jargon without payoff.',
      criteria: anchors(
        'Incoherent, rambling, or unreadable.',
        'Reader must reread to parse meaning.',
        'Competent prose; minor friction.',
        'Professional clarity throughout.',
        'Exceptionally clear; each sentence earns its place.'
      ),
    },
    {
      id: 'depth',
      name: 'Depth & Substance',
      weight: 0.2,
      passThreshold: 6,
      description: 'Ideas go beyond surface; concrete detail, insight, or evidence.',
      criteria: anchors(
        'Surface-level filler; no real content.',
        'Generic statements, few specifics.',
        'Competent substance; some specifics.',
        'Professional depth with insight.',
        'Exceptional — original insight or rare specificity.'
      ),
    },
    {
      id: 'engagement',
      name: 'Engagement & Voice',
      weight: 0.2,
      passThreshold: 6,
      description: 'Voice draws the reader; tone fits audience and purpose.',
      criteria: anchors(
        'Dead prose; reader disengages instantly.',
        'Flat but functional.',
        'Competent voice; holds attention.',
        'Professional voice; actively engaging.',
        'Exceptional voice; memorable.'
      ),
    },
    {
      id: 'accuracy',
      name: 'Accuracy & Credibility',
      weight: 0.15,
      passThreshold: 6,
      description: 'Claims are correct; no hallucinations; sourcing or reasoning holds up.',
      criteria: anchors(
        'Factually wrong or clearly fabricated.',
        'Vague claims; likely inaccurate in places.',
        'Competent accuracy; no obvious errors.',
        'Professional accuracy with reasoning.',
        'Exceptional — verifiable and well-grounded.'
      ),
    },
    {
      id: 'structure_completeness',
      name: 'Structure & Completeness',
      weight: 0.25,
      passThreshold: 6,
      description: 'Has a beginning/middle/end; covers what was asked; nothing is truncated or missing.',
      criteria: anchors(
        'Truncated, missing sections, or off-topic.',
        'Incomplete or poorly organized.',
        'Competent structure; covers the ask.',
        'Professional organization; nothing missing.',
        'Structure fits the topic (timeline for historical, mechanism-flow for process, comparison-structure for vs-articles, claim-evidence for argumentative) — not a generic H2 skeleton.'
      ),
    },
  ],
}

export function validateTextRubric(rubric: RubricDefinition = TEXT_RUBRIC): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const sum = rubric.dimensions.reduce((s, d) => s + d.weight, 0)
  if (Math.abs(sum - 1) > 0.001) errors.push(`weights sum to ${sum}, expected 1`)
  const completeness = rubric.dimensions.find((d) => d.id === 'structure_completeness')
  if (!completeness) errors.push('missing structure_completeness dimension')
  else if (completeness.weight < 0.2)
    errors.push(`completeness weight ${completeness.weight} < 0.20`)
  return { valid: errors.length === 0, errors }
}
