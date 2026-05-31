#!/usr/bin/env tsx
// Row-count inspector for the CreatorOS dev DB.
// Usage: npx tsx scripts/inspect-db.ts
//
// Prints count(*) for every V1 table. Used to verify CR-1 seed state
// without opening Prisma Studio.
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set — expected in .env / .env.local')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  const counts = {
    User: await db.user.count(),
    CreatorPersona: await db.creatorPersona.count(),
    Workspace: await db.workspace.count(),
    Idea: await db.idea.count(),
    LongFormMaster: await db.longFormMaster.count(),
    LongFormSection: await db.longFormSection.count(),
    ResearchSource: await db.researchSource.count(),
    SourceRef: await db.sourceRef.count(),
    Artifact: await db.artifact.count(),
    StageSession: await db.stageSession.count(),
    IterationRecord: await db.iterationRecord.count(),
  }

  console.log('Row counts:')
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(16)} ${n}`)
  }
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
