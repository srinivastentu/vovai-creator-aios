// CreatorOS seed (CR-1)
// Seeds the V1 acceptance-test fixtures: the local user, the reviewed
// BuildOS Creator persona (verbatim from docs/02-domain/buildos-persona.md),
// one workspace, and one captured idea.
//
// Idempotent: upserts on stable ids so it can be re-run safely.
// Run with: npm run db:seed
//
// dotenv/config loads DATABASE_URL from .env (tsx does not auto-load it).
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set — expected in .env / .env.local')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

// Stable ids keep the seed idempotent and give CR-2+ scripts a known
// idea to target.
const USER_ID = 'local-user'
const PERSONA_ID = 'buildos-persona'
const WORKSPACE_ID = 'buildos-workspace'
const IDEA_ID = 'cross-critique-idea'

// Verbatim from docs/02-domain/buildos-persona.md "Seed values".
// Do not improvise — this persona is graded by the V1 acceptance test.
const BUILDOS_PERSONA = {
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
}

async function main() {
  const user = await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: 'local@creator.os' },
  })

  const persona = await db.creatorPersona.upsert({
    where: { id: PERSONA_ID },
    update: {
      name: BUILDOS_PERSONA.name,
      niches: BUILDOS_PERSONA.niches,
      voiceTone: BUILDOS_PERSONA.voiceTone,
      audienceProfile: BUILDOS_PERSONA.audienceProfile,
      creatorProfile: BUILDOS_PERSONA.creatorProfile,
      defaultRubricRefs: BUILDOS_PERSONA.defaultRubricRefs,
    },
    create: {
      id: PERSONA_ID,
      userId: user.id,
      name: BUILDOS_PERSONA.name,
      niches: BUILDOS_PERSONA.niches,
      voiceTone: BUILDOS_PERSONA.voiceTone,
      audienceProfile: BUILDOS_PERSONA.audienceProfile,
      creatorProfile: BUILDOS_PERSONA.creatorProfile,
      defaultRubricRefs: BUILDOS_PERSONA.defaultRubricRefs,
    },
  })

  const workspace = await db.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id: WORKSPACE_ID,
      userId: user.id,
      personaId: persona.id,
      name: 'BuildOS Creator',
      description: 'Content production workspace for the BuildOS Creator persona (agentic AI / AI engineering).',
      role: 'admin',
    },
  })

  const idea = await db.idea.upsert({
    where: { id: IDEA_ID },
    update: {},
    create: {
      id: IDEA_ID,
      workspaceId: workspace.id,
      title: 'Why sequential cross-critique beats tournament for content generation',
      description: 'The V1 thesis idea: for text artifacts, a sequential cross-critique loop (two producers, mutual critique, an integrator that synthesizes) beats tournament-style winner-take-all selection.',
      niches: ['agentic AI', 'AI engineering'],
      status: 'captured',
    },
  })

  console.log('Seed complete:')
  console.log(`  User:           ${user.id} <${user.email}>`)
  console.log(`  CreatorPersona: ${persona.id} "${persona.name}" niches=${JSON.stringify(persona.niches)}`)
  console.log(`  Workspace:      ${workspace.id} "${workspace.name}" role=${workspace.role}`)
  console.log(`  Idea:           ${idea.id} "${idea.title}" status=${idea.status}`)
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await db.$disconnect()
    process.exit(1)
  })
