// BuildOS acceptance-test fixture (CR-12).
//
// The single source of truth for the V1 acceptance scenario: the local user,
// the reviewed BuildOS Creator persona (verbatim from
// docs/02-domain/buildos-persona.md), one workspace, and one captured idea.
//
// Extracted from prisma/seed.ts in CR-12 so the seed script AND the
// tests/e2e/v1-acceptance.test.ts run against byte-identical persona/idea
// content — the acceptance test grades voice fidelity against THIS persona, so
// a single shared definition prevents drift between "what we seed" and "what we
// grade."
//
// Pure data + one idempotent upsert helper. No env, no I/O beyond the injected
// Prisma client — callable from a CLI script or an in-process test alike.
import type { PrismaClient } from '../../src/generated/prisma/client'

// Stable ids keep the seed idempotent and give CR-2+ scripts + the acceptance
// test a known scenario to target.
export const BUILDOS_IDS = {
  userId: 'local-user',
  personaId: 'buildos-persona',
  workspaceId: 'buildos-workspace',
  ideaId: 'cross-critique-idea',
} as const

export const BUILDOS_USER = {
  id: BUILDOS_IDS.userId,
  email: 'local@creator.os',
} as const

// Verbatim from docs/02-domain/buildos-persona.md "Seed values".
// Do not improvise — this persona is graded by the V1 acceptance test.
export const BUILDOS_PERSONA = {
  name: 'BuildOS Creator',
  niches: ['agentic AI', 'AI engineering'],

  voiceTone: {
    formality: 'Conversational-expert. Peer-to-peer with builders. No corporate gloss.',
    vocabulary: 'Technical but plain. Precise nouns over adjectives. Name the pattern, show the tradeoff.',
    signaturePhrases: [
      'build in public',
      'ship it, then prove it',
      'the differentiator is',
      'let me show you the machinery',
      'here is the tradeoff',
    ],
    doNotSay: [
      'revolutionary', 'game-changer', 'game-changing', 'unleash',
      'leverage synergies', 'in today’s fast-paced world',
      'dive deep', 'unlock', 'supercharge', 'seamless',
      'it’s not just X, it’s Y',
    ],
    sentenceRhythm: 'Vary length. Short punch lines for emphasis. No three-clause em-dash pileups.',
    emojiPolicy: 'Sparingly. Never decorative. A single marker emoji at most.',
  },

  audienceProfile: {
    primaryRole: 'AI builders and software engineers exploring agentic systems',
    experienceLevel: 'Intermediate-to-senior developers who ship',
    interests: [
      'LLM orchestration', 'agent architectures', 'eval & quality loops',
      'RAG and context engineering', 'turning demos into products',
    ],
    painPoints: [
      'AI demos that collapse in production',
      'prompt spaghetti with no structure',
      'no evaluation discipline',
      'hype that hides the actual engineering',
    ],
    whatTheyWant: 'Concrete patterns, honest tradeoffs, and code/architecture-level specifics they can apply this week.',
  },

  creatorProfile: {
    name: 'Srinivas',
    bio: 'Founder building VOVAI — an agentic AIOS platform — in public. Writes about the engineering behind reliable AI systems.',
    expertiseAreas: [
      'agentic system design', 'loop & evaluation architectures',
      'multi-model orchestration', 'content + product strategy',
    ],
    pointOfView: 'Quality in AI products comes from disciplined loops and human gates, not from a bigger model. Show the machinery, name the tradeoffs.',
    signatureHooks: [
      'a counter-intuitive claim, then the proof',
      'behind-the-scenes of a real build decision',
      'a hard tradeoff named plainly',
    ],
    credibilityMarkers: [
      'real architecture decisions with rationale',
      'named, reusable patterns',
      'cost / latency / quality numbers when they exist',
    ],
  },

  defaultRubricRefs: {
    research: 'research-rubric',
    longFormMaster: 'long-form-master-rubric',
    linkedinPost: 'linkedin-post-rubric',
    article: 'article-rubric',
  },
} as const

export const BUILDOS_IDEA = {
  title: 'Why sequential cross-critique beats tournament for content generation',
  description:
    'The V1 thesis idea: for text artifacts, a sequential cross-critique loop (two producers, mutual critique, an integrator that synthesizes) beats tournament-style winner-take-all selection.',
  niches: ['agentic AI', 'AI engineering'],
} as const

export interface BuildOsScenarioRows {
  userId: string
  personaId: string
  workspaceId: string
  ideaId: string
}

/**
 * Idempotently upsert the full BuildOS acceptance scenario (user → persona →
 * workspace → idea) on the stable ids above. Safe to call repeatedly; returns
 * the canonical ids. Used by prisma/seed.ts and the V1 acceptance test.
 */
export async function upsertBuildOsScenario(
  db: PrismaClient,
): Promise<BuildOsScenarioRows> {
  const user = await db.user.upsert({
    where: { id: BUILDOS_USER.id },
    update: {},
    create: { id: BUILDOS_USER.id, email: BUILDOS_USER.email },
  })

  const persona = await db.creatorPersona.upsert({
    where: { id: BUILDOS_IDS.personaId },
    update: {
      name: BUILDOS_PERSONA.name,
      niches: [...BUILDOS_PERSONA.niches],
      voiceTone: BUILDOS_PERSONA.voiceTone,
      audienceProfile: BUILDOS_PERSONA.audienceProfile,
      creatorProfile: BUILDOS_PERSONA.creatorProfile,
      defaultRubricRefs: BUILDOS_PERSONA.defaultRubricRefs,
    },
    create: {
      id: BUILDOS_IDS.personaId,
      userId: user.id,
      name: BUILDOS_PERSONA.name,
      niches: [...BUILDOS_PERSONA.niches],
      voiceTone: BUILDOS_PERSONA.voiceTone,
      audienceProfile: BUILDOS_PERSONA.audienceProfile,
      creatorProfile: BUILDOS_PERSONA.creatorProfile,
      defaultRubricRefs: BUILDOS_PERSONA.defaultRubricRefs,
    },
  })

  const workspace = await db.workspace.upsert({
    where: { id: BUILDOS_IDS.workspaceId },
    update: {},
    create: {
      id: BUILDOS_IDS.workspaceId,
      userId: user.id,
      personaId: persona.id,
      name: 'BuildOS Creator',
      description:
        'Content production workspace for the BuildOS Creator persona (agentic AI / AI engineering).',
      role: 'admin',
    },
  })

  const idea = await db.idea.upsert({
    where: { id: BUILDOS_IDS.ideaId },
    update: {},
    create: {
      id: BUILDOS_IDS.ideaId,
      workspaceId: workspace.id,
      title: BUILDOS_IDEA.title,
      description: BUILDOS_IDEA.description,
      niches: [...BUILDOS_IDEA.niches],
      status: 'captured',
    },
  })

  return {
    userId: user.id,
    personaId: persona.id,
    workspaceId: workspace.id,
    ideaId: idea.id,
  }
}
