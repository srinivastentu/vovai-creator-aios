/**
 * Seed script for Project Component layer (PC-1.3)
 * Creates test project, blueprint, nodes, components, and ideation conversation
 *
 * Run: npm run db:seed:pc
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main() {
  console.log('🌱 Seeding Project Component layer...\n')

  // 1. Find or create test Project
  let project = await db.project.findFirst({
    where: { name: 'Teacher Retooling in ID' },
  })

  if (!project) {
    project = await db.project.create({
      data: {
        name: 'Teacher Retooling in ID',
        topic: 'Instructional Design',
        targetAudience: 'Mid-career CBSE teachers',
        durationMinutes: 2400,
      },
    })
    console.log(`  Created project: ${project.name}`)
  } else {
    console.log(`  Found existing project: ${project.name}`)
  }

  // 2. Create ProjectBlueprint
  const existingBlueprint = await db.projectBlueprint.findUnique({
    where: { projectId: project.id },
  })

  if (existingBlueprint) {
    console.log('  Blueprint already exists — cleaning up for fresh seed...')
    // Delete in dependency order
    const convos = await db.ideationConversation.findMany({
      where: { blueprintId: existingBlueprint.id },
      select: { id: true },
    })
    for (const c of convos) {
      await db.ideationMessage.deleteMany({ where: { conversationId: c.id } })
    }
    await db.ideationConversation.deleteMany({ where: { blueprintId: existingBlueprint.id } })
    await db.blueprintVersion.deleteMany({ where: { blueprintId: existingBlueprint.id } })
    await db.structureGrade.deleteMany({ where: { blueprintId: existingBlueprint.id } })

    const nodes = await db.projectNode.findMany({
      where: { blueprintId: existingBlueprint.id },
      select: { id: true },
    })
    for (const n of nodes) {
      await db.nodeComponent.deleteMany({ where: { nodeId: n.id } })
    }
    // Delete children before parents (depth desc)
    await db.projectNode.deleteMany({
      where: { blueprintId: existingBlueprint.id, depth: 2 },
    })
    await db.projectNode.deleteMany({
      where: { blueprintId: existingBlueprint.id, depth: 1 },
    })
    await db.projectNode.deleteMany({
      where: { blueprintId: existingBlueprint.id, depth: 0 },
    })
    await db.projectBlueprint.delete({ where: { id: existingBlueprint.id } })
  }

  const blueprint = await db.projectBlueprint.create({
    data: {
      projectId: project.id,
      archetype: 'professional_training',
      hierarchyLabels: {
        level0: 'Course',
        level1: 'Module',
        level2: 'Topic',
        level3: 'Subtopic',
      },
      targetAudience: {
        description: 'Mid-career CBSE teachers transitioning to instructional design roles',
        experienceLevel: '5-15 years',
      },
      learningOutcomes: [
        'Understand core instructional design principles',
        'Apply the ADDIE framework to course creation',
        'Evaluate and select appropriate digital tools',
      ],
      enabledComponents: ['video', 'study_material', 'quiz', 'activity', 'capstone'],
      ideationPhase: 'brainstorm',
    },
  })
  console.log(`  Created blueprint: ${blueprint.id}`)

  // 3. Create ProjectNodes — realistic tree
  type NodeDef = {
    title: string
    depth: number
    sortOrder: number
    children?: NodeDef[]
    components?: { type: string; priority: 'core' | 'recommended' | 'optional' }[]
  }

  const tree: NodeDef[] = [
    {
      title: 'Foundations of ID',
      depth: 0,
      sortOrder: 0,
      components: [
        { type: 'video', priority: 'core' },         // Module overview video
        { type: 'quiz', priority: 'core' },           // Module assessment
        { type: 'activity', priority: 'recommended' }, // Module exercise
        { type: 'capstone', priority: 'core' },        // Module capstone
      ],
      children: [
        {
          title: 'What is Instructional Design?',
          depth: 1,
          sortOrder: 0,
          components: [
            { type: 'video', priority: 'core' },
            { type: 'quiz', priority: 'core' },
            { type: 'study_material', priority: 'recommended' },
          ],
          children: [
            { title: 'History of ID', depth: 2, sortOrder: 0 },
            { title: 'ID Roles & Responsibilities', depth: 2, sortOrder: 1 },
          ],
        },
        {
          title: 'Learning Theories',
          depth: 1,
          sortOrder: 1,
          components: [
            { type: 'video', priority: 'core' },
            { type: 'quiz', priority: 'core' },
            { type: 'study_material', priority: 'recommended' },
            { type: 'activity', priority: 'recommended' },
          ],
          children: [
            { title: 'Behaviorism', depth: 2, sortOrder: 0 },
            { title: 'Constructivism', depth: 2, sortOrder: 1 },
          ],
        },
      ],
    },
    {
      title: 'ADDIE Framework',
      depth: 0,
      sortOrder: 1,
      components: [
        { type: 'video', priority: 'core' },         // Module overview video
        { type: 'quiz', priority: 'core' },           // Module assessment
        { type: 'activity', priority: 'recommended' }, // Module exercise
      ],
      children: [
        {
          title: 'Analysis Phase',
          depth: 1,
          sortOrder: 0,
          components: [
            { type: 'video', priority: 'core' },
            { type: 'quiz', priority: 'core' },
            { type: 'study_material', priority: 'recommended' },
          ],
        },
        {
          title: 'Design Phase',
          depth: 1,
          sortOrder: 1,
          components: [
            { type: 'video', priority: 'core' },
            { type: 'quiz', priority: 'core' },
            { type: 'study_material', priority: 'recommended' },
          ],
        },
      ],
    },
    {
      title: 'Digital Tools for ID',
      depth: 0,
      sortOrder: 2,
      components: [
        { type: 'video', priority: 'core' },         // Module overview video
        { type: 'quiz', priority: 'core' },           // Module assessment
        { type: 'activity', priority: 'recommended' }, // Module exercise
      ],
      children: [
        {
          title: 'Authoring Tools',
          depth: 1,
          sortOrder: 0,
          components: [
            { type: 'video', priority: 'core' },
            { type: 'quiz', priority: 'core' },
          ],
        },
      ],
    },
  ]

  let nodeCount = 0
  let componentCount = 0

  async function createNodes(
    nodes: NodeDef[],
    parentId: string | null,
    parentPath: string,
  ) {
    for (const nodeDef of nodes) {
      const slug = slugify(nodeDef.title)
      const path = parentPath ? `${parentPath}/${slug}` : `/${slug}`

      const node = await db.projectNode.create({
        data: {
          blueprintId: blueprint.id,
          parentId,
          title: nodeDef.title,
          slug,
          depth: nodeDef.depth,
          sortOrder: nodeDef.sortOrder,
          path,
          status: 'draft',
          learningOutcomes: [],
        },
      })
      nodeCount++

      // Create components (modules get overview/assessment/exercises, topics get production components)
      if (nodeDef.components) {
        for (const comp of nodeDef.components) {
          await db.nodeComponent.create({
            data: {
              nodeId: node.id,
              componentType: comp.type,
              priority: comp.priority,
              status: 'planned',
            },
          })
          componentCount++
        }
      }

      if (nodeDef.children) {
        await createNodes(nodeDef.children, node.id, path)
      }
    }
  }

  await createNodes(tree, null, '')
  console.log(`  Created ${nodeCount} nodes, ${componentCount} components`)

  // 5. Create IdeationConversation with 3 sample messages
  const conversation = await db.ideationConversation.create({
    data: {
      blueprintId: blueprint.id,
      phase: 'brainstorm',
    },
  })

  const messages = [
    {
      role: 'human' as const,
      messageType: 'text',
      content:
        'I need a teacher retooling program on instructional design. The audience is mid-career CBSE teachers with 5-15 years of experience who want to transition into ID roles. The program should be comprehensive but practical, roughly 40 hours of content.',
    },
    {
      role: 'facilitator' as const,
      messageType: 'suggestion',
      content:
        'Based on your brief, I see a 3-module professional training course: (1) Foundations of Instructional Design covering theory and history, (2) The ADDIE Framework as the practical backbone, and (3) Digital Tools for modern ID work. Each module would have 2-3 topics with video lessons, quizzes, and study materials. Shall I flesh out this structure?',
    },
    {
      role: 'pedagogy_expert' as const,
      messageType: 'suggestion',
      content:
        'For mid-career teachers, I recommend experiential learning throughout. They already have classroom expertise — we should leverage that. Each topic should include an activity where they apply ID principles to their existing teaching materials. The capstone should be designing a complete mini-course using the ADDIE framework.',
    },
  ]

  for (const msg of messages) {
    await db.ideationMessage.create({
      data: {
        conversationId: conversation.id,
        role: msg.role,
        messageType: msg.messageType,
        content: msg.content,
      },
    })
  }
  console.log(`  Created 1 conversation with ${messages.length} messages`)

  // 6. Summary
  console.log('\n✅ Seed complete!')
  console.log(`   Projects:     1`)
  console.log(`   Blueprints:   1`)
  console.log(`   Nodes:        ${nodeCount}`)
  console.log(`   Components:   ${componentCount}`)
  console.log(`   Messages:     ${messages.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
