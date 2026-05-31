// LONG_FORM_ARTICLE_RUBRIC — Stage 5b (Repurpose → long-form article).
// Domain configuration: grades an ArticleArtifact. Per docs/02-domain/rubrics.md.
//
// Scoring model (rubrics.md Rule 4): the judge scores each dimension 1–10;
// the composite is Σ(score · weight · 10) → a 0–100 score. Threshold 80.
// Dimension pass bars are on the 1–10 scale.
//
// 6 dimensions; completeness ≥ 0.20 (Forge ADOPT 6). The producer NEVER sees
// this rubric (rubrics.md Rule 5) — it receives PRESERVE/IMPROVE feedback only.

import type { RubricDefinition } from '../../../../core/engine/types'

/** Anchor descriptions keyed by 1–10 score level. */
const anchors = (low: string, four: string, seven: string, nine: string) => ({
  '1': low,
  '4': four,
  '7': seven,
  '9': nine,
})

export const LONG_FORM_ARTICLE_RUBRIC: RubricDefinition = {
  id: 'long-form-article-rubric',
  name: 'Long-Form Article Quality (6-dimension)',
  passThreshold: 80,
  dimensions: [
    {
      id: 'personaFit',
      name: 'Persona Fit',
      weight: 0.18,
      passThreshold: 7,
      description:
        "The persona's voice, register, and point of view stay consistent across every section — no drift into generic AI prose. Uses no do-not-say phrase.",
      criteria: anchors(
        'Generic article voice; could be anyone. Uses a banned phrase or hype.',
        'Persona present in places, but the voice drifts generic across sections.',
        'Consistent persona voice and POV throughout; no banned phrases.',
        'Unmistakably this creator end to end — the thesis and register never slip.'
      ),
    },
    {
      id: 'audienceFit',
      name: 'Audience Fit',
      weight: 0.16,
      passThreshold: 7,
      description:
        "Right depth and framing for the persona's stated audience — neither over-explained nor over their head.",
      criteria: anchors(
        'Pitched at the wrong audience or depth entirely.',
        'Roughly relevant, but depth or assumptions are off for the audience.',
        'Correct depth and concern for the stated audience throughout.',
        "Calibrated precisely to the audience's expertise and what they came to learn."
      ),
    },
    {
      id: 'platformFit',
      name: 'Platform Fit',
      weight: 0.14,
      passThreshold: 7,
      description:
        'Blog / Substack-shaped: an H1 title, descriptive H2 sections, digestible paragraphs — long-form, not a LinkedIn post or a listicle.',
      criteria: anchors(
        'Wrong shape — a social post, a listicle, or an unbroken essay.',
        'Long-form-ish, but headings or paragraphing fight readability.',
        'Properly article-shaped: H1, descriptive H2s, paragraphs of digestible length.',
        'Reads like a strong published essay: heading hierarchy and pacing carry the read.'
      ),
    },
    {
      id: 'introStrength',
      name: 'Intro Strength',
      weight: 0.14,
      passThreshold: 7,
      description:
        'The first 100–200 words earn the article — a concrete claim, a named tension, or a real moment — and frame what follows. No throat-clearing.',
      criteria: anchors(
        'Generic windup; the intro could precede any article and promises nothing.',
        'Some framing, but the intro is soft or slow to reach the point.',
        'A concrete, specific intro that frames the piece and earns the next scroll.',
        'An opening that compels the full read and sets up the payoff precisely.'
      ),
    },
    {
      id: 'structuralQuality',
      name: 'Structural Quality',
      weight: 0.18,
      passThreshold: 7,
      description:
        'Clear heading hierarchy and a real intro → body → conclusion arc; each H2 makes one point with substance; the conclusion resolves the piece.',
      criteria: anchors(
        'No discernible arc; sections are interchangeable or the conclusion is missing.',
        'A loose arc, but sections overlap or the conclusion just restates.',
        'Clean intro/body/conclusion arc; each H2 advances one substantive point.',
        'Architecturally tight: sections build an argument; the conclusion earns its claim.'
      ),
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.2,
      passThreshold: 7,
      description:
        'A whole article in 1,200–3,000 words, with ≥2 H2 body sections and an explicit conclusion; nothing truncated mid-thought.',
      criteria: anchors(
        'Out of the word band, truncated, or missing H2 sections / a conclusion.',
        'In band but thin, or a structural element (H2s / conclusion) is weak.',
        '1,200–3,000 words, ≥2 H2 sections, an explicit conclusion, nothing cut off.',
        'Fully realised within the band: complete argument, clean structure, publishable as-is.'
      ),
    },
  ],
}

/** Structural self-check (weights sum to 1.0; completeness ≥ 0.20). */
export function validateArticleRubric(
  rubric: RubricDefinition = LONG_FORM_ARTICLE_RUBRIC
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
