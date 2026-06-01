// CreatorOS seed (CR-1; CR-12 extracted the fixture to prisma/fixtures/buildos.ts)
// Seeds the V1 acceptance-test fixtures: the local user, the reviewed
// BuildOS Creator persona (verbatim from docs/02-domain/buildos-persona.md),
// one workspace, and one captured idea.
//
// The scenario definition + upsert now live in prisma/fixtures/buildos.ts so
// the seed and the V1 acceptance test (tests/e2e/v1-acceptance.test.ts) share
// one byte-identical persona — the acceptance test grades voice against it.
//
// Idempotent: upserts on stable ids so it can be re-run safely.
// Run with: npm run db:seed
//
// dotenv/config loads DATABASE_URL from .env (tsx does not auto-load it).
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  upsertBuildOsScenario,
  BUILDOS_PERSONA,
  BUILDOS_IDEA,
} from './fixtures/buildos'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set — expected in .env / .env.local')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  const rows = await upsertBuildOsScenario(db)

  console.log('Seed complete:')
  console.log(`  User:           ${rows.userId} <local@creator.os>`)
  console.log(
    `  CreatorPersona: ${rows.personaId} "${BUILDOS_PERSONA.name}" niches=${JSON.stringify(BUILDOS_PERSONA.niches)}`,
  )
  console.log(`  Workspace:      ${rows.workspaceId} "BuildOS Creator" role=admin`)
  console.log(`  Idea:           ${rows.ideaId} "${BUILDOS_IDEA.title}" status=captured`)
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
