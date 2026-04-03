/**
 * Delete projects that have no associated blueprint.
 *
 * Run: npx tsx scripts/cleanup-orphaned-projects.ts
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  const orphans = await db.project.findMany({
    where: { blueprint: null },
    select: { id: true, name: true, createdAt: true },
  })

  if (orphans.length === 0) {
    console.log('No orphaned projects found.')
    return
  }

  console.log(`Found ${orphans.length} orphaned project(s):`)
  for (const p of orphans) {
    console.log(`  - ${p.name} (${p.id}) created ${p.createdAt.toISOString()}`)
  }

  const deleted = await db.project.deleteMany({
    where: { id: { in: orphans.map(p => p.id) } },
  })

  console.log(`Deleted ${deleted.count} orphaned project(s).`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
