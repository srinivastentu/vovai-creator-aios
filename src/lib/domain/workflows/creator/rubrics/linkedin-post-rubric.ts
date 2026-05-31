// LINKEDIN_POST_RUBRIC — Stage 5a (Repurpose → LinkedIn post).
// Domain configuration: grades a LinkedInArtifact. Per docs/02-domain/rubrics.md.
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

export const LINKEDIN_POST_RUBRIC: RubricDefinition = {
  id: 'linkedin-post-rubric',
  name: 'LinkedIn Post Quality (6-dimension)',
  passThreshold: 80,
  dimensions: [
    {
      id: 'personaFit',
      name: 'Persona Fit',
      weight: 0.18,
      passThreshold: 7,
      description:
        "Sounds like the creator — their formality, vocabulary, cadence, and point of view — not a generic AI writer. Uses no do-not-say phrase.",
      criteria: anchors(
        'Generic AI voice; could be any LinkedIn post. Uses a banned phrase or hype.',
        'Occasional persona flavor, but the voice slips into generic register often.',
        'Recognisably the persona: formality, vocabulary, and POV are consistent; no banned phrases.',
        'Unmistakably this creator — POV thesis lands, signature moves used naturally, zero AI tells.'
      ),
    },
    {
      id: 'audienceFit',
      name: 'Audience Fit',
      weight: 0.16,
      passThreshold: 7,
      description:
        "Speaks to the persona's stated audience — their level, what they care about, the language they use.",
      criteria: anchors(
        "Aimed at no one in particular, or the wrong audience entirely.",
        'Loosely relevant to the audience; depth or framing is off for them.',
        'Clearly written for the stated audience at the right level and concern.',
        "Nails the audience's exact pain and language; they would feel it was written for them."
      ),
    },
    {
      id: 'platformFit',
      name: 'Platform Fit',
      weight: 0.16,
      passThreshold: 7,
      description:
        'LinkedIn-shaped: short scannable paragraphs, blank-line breaks, no walls of text, no inline citations or footnotes.',
      criteria: anchors(
        'Reads like an essay or a tweet — wrong shape for the LinkedIn feed.',
        'Some structure, but dense blocks or formatting that fights the feed remain.',
        'Properly LinkedIn-shaped: scannable paragraphs, clean breaks, feed-native.',
        'Optimised for the feed: rhythm, whitespace, and line breaks all earn the scroll.'
      ),
    },
    {
      id: 'hookStrength',
      name: 'Hook Strength',
      weight: 0.15,
      passThreshold: 7,
      description:
        'The first 3 lines pull a reader in — a specific claim, a named tension, or a concrete moment — never a throat-clear.',
      criteria: anchors(
        'Generic opener ("In today\'s world…"); a reader keeps scrolling.',
        'Mild interest, but the hook is soft or buries the point past line 3.',
        'The first 3 lines make a reader stop: specific, concrete, or surprising.',
        'A hook a LinkedIn-hater would stop for; line 3 escalates or pays off line 1.'
      ),
    },
    {
      id: 'structuralQuality',
      name: 'Structural Quality',
      weight: 0.15,
      passThreshold: 7,
      description:
        'Scannable flow with one clear through-line and exactly one closing thought (question or CTA), not three.',
      criteria: anchors(
        'Rambling or list-of-everything; no clear arc; multiple competing closers.',
        'A discernible point, but the flow wanders or the close is muddled.',
        'One clear through-line, scannable beats, a single clean closing thought.',
        'Tight architecture: every line advances one idea; the close lands with intent.'
      ),
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.2,
      passThreshold: 7,
      description:
        'A whole post in 1,300–3,000 characters, with ≥2 paragraph breaks and a present 3-line hook; nothing truncated.',
      criteria: anchors(
        'Out of the character band, truncated mid-thought, or missing the hook/breaks.',
        'In band but thin, or a structural element (breaks/hook) is weak.',
        '1,300–3,000 chars, ≥2 paragraph breaks, a real 3-line hook, nothing cut off.',
        'Fully realised within the band: complete arc, clean structure, publishable as-is.'
      ),
    },
  ],
}

/** Structural self-check (weights sum to 1.0; completeness ≥ 0.20). */
export function validateLinkedInRubric(
  rubric: RubricDefinition = LINKEDIN_POST_RUBRIC
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
