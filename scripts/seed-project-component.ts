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

  // 5. Create IdeationConversations with sample messages across phases
  // --- Brainstorm phase ---
  const brainstormConvo = await db.ideationConversation.create({
    data: {
      blueprintId: blueprint.id,
      phase: 'brainstorm',
    },
  })

  const brainstormMessages = [
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

  for (const msg of brainstormMessages) {
    await db.ideationMessage.create({
      data: {
        conversationId: brainstormConvo.id,
        role: msg.role,
        messageType: msg.messageType,
        content: msg.content,
      },
    })
  }

  // --- Structure phase ---
  const structureConvo = await db.ideationConversation.create({
    data: {
      blueprintId: blueprint.id,
      phase: 'structure',
    },
  })

  const structureMessages = [
    {
      role: 'structure_architect' as const,
      messageType: 'structure_update',
      content:
        'I\'ve built out the full hierarchy. Module 1 "Foundations of ID" has 2 topics (What is ID?, Learning Theories) each with 2 subtopics. Module 2 "ADDIE Framework" covers Analysis and Design phases. Module 3 "Digital Tools" focuses on Authoring Tools. Total: 3 modules, 5 topics, 4 subtopics. The progression follows a theory → framework → application arc.',
    },
    {
      role: 'audience_analyst' as const,
      messageType: 'suggestion',
      content:
        'The structure looks solid for mid-career teachers. One concern: Module 3 has only 1 topic while Modules 1-2 have 2 each. Consider adding a "Collaboration & LMS Platforms" topic to balance the workload and cover tools teachers will actually use in their institutions.',
    },
    {
      role: 'human' as const,
      messageType: 'text',
      content:
        'Good point about the balance. Let\'s keep Module 3 focused for now — we can always expand it later. Move forward with grading this structure.',
    },
  ]

  for (const msg of structureMessages) {
    await db.ideationMessage.create({
      data: {
        conversationId: structureConvo.id,
        role: msg.role,
        messageType: msg.messageType,
        content: msg.content,
      },
    })
  }

  // --- Refinement phase ---
  const refinementConvo = await db.ideationConversation.create({
    data: {
      blueprintId: blueprint.id,
      phase: 'refinement',
    },
  })

  const refinementMessages = [
    {
      role: 'critic' as const,
      messageType: 'suggestion',
      content:
        'The rubric flagged "Balance" at 68 (below the 65 threshold it passes, but barely). Module 3 has 1 topic vs 2 for the others. The "Progression" score of 82 is strong — the theory→framework→tools arc works well. I suggest we strengthen Module 3 descriptions to show it\'s intentionally focused, not incomplete.',
    },
    {
      role: 'facilitator' as const,
      messageType: 'decision',
      content:
        'Refinement complete. Updated Module 3 description to clarify its focused scope. Overall score improved from 74.6 to 78.2. All dimensions now pass their individual thresholds. The structure is ready for human review.',
    },
  ]

  for (const msg of refinementMessages) {
    await db.ideationMessage.create({
      data: {
        conversationId: refinementConvo.id,
        role: msg.role,
        messageType: msg.messageType,
        content: msg.content,
      },
    })
  }

  let totalMessages = brainstormMessages.length + structureMessages.length + refinementMessages.length
  console.log(`  Created 3 conversations with ${totalMessages} messages`)

  // 6. Create StructureGrade with realistic 7-dimension scores
  const dimensionScores = [
    { id: 'coverage', name: 'Coverage', score: 82, weight: 0.18, passThreshold: 70, feedback: 'Learning outcomes cover all three modules well. Minor gap: no explicit outcome for collaborative ID workflows.' },
    { id: 'depth', name: 'Depth', score: 76, weight: 0.15, passThreshold: 65, feedback: 'Hierarchy is 3 levels deep (Module → Topic → Subtopic). Adequate for a 40-hour program. Subtopics could be more granular in Module 2.' },
    { id: 'progression', name: 'Progression', score: 82, weight: 0.18, passThreshold: 75, feedback: 'Strong theory → framework → application arc. Topics build logically within each module.' },
    { id: 'balance', name: 'Balance', score: 68, weight: 0.12, passThreshold: 65, feedback: 'Module 3 has 1 topic vs 2 for others. Borderline but acceptable given the focused scope. Consider expanding if time permits.' },
    { id: 'engagement', name: 'Engagement', score: 80, weight: 0.15, passThreshold: 70, feedback: 'Good mix of videos, quizzes, activities, and capstone. Each module has hands-on components.' },
    { id: 'feasibility', name: 'Feasibility', score: 85, weight: 0.10, passThreshold: 60, feedback: '40 hours is realistic for 3 modules with the proposed component mix. Production cost within typical range.' },
    { id: 'coherence', name: 'Coherence', score: 74, weight: 0.12, passThreshold: 70, feedback: 'Most components serve clear learning outcomes. The capstone in Module 1 could be better tied to specific topic outcomes.' },
  ]
  // Weighted average: 82*0.18 + 76*0.15 + 82*0.18 + 68*0.12 + 80*0.15 + 85*0.10 + 74*0.12 = 78.62
  const overallScore = 78.62

  await db.structureGrade.create({
    data: {
      blueprintId: blueprint.id,
      overallScore,
      dimensionScores,
      recommendation: 'revise',
      feedback: 'Structure passes overall threshold (78.62 >= 75). Balance dimension is borderline at 68 — consider expanding Module 3. Coherence could be tightened by mapping capstone outcomes more explicitly.',
    },
  })
  console.log(`  Created StructureGrade (overall: ${overallScore})`)

  // 7. Update blueprint with ideation score and structure summary
  await db.projectBlueprint.update({
    where: { id: blueprint.id },
    data: {
      ideationPhase: 'refinement',
      ideationScore: overallScore,
      structureSummary: {
        totalModules: 3,
        totalTopics: 5,
        totalSubtopics: 4,
        componentBreakdown: { video: 10, quiz: 10, study_material: 5, activity: 4, capstone: 2 },
        estimatedHours: 40,
        overallScore,
        recommendation: 'revise',
      },
    },
  })
  console.log(`  Updated blueprint: ideationScore=${overallScore}, phase=refinement`)

  // 8. Create BlueprintVersion (snapshot of current state)
  const allNodes = await db.projectNode.findMany({
    where: { blueprintId: blueprint.id },
    orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
  })
  const allComponents = await db.nodeComponent.findMany({
    where: { nodeId: { in: allNodes.map(n => n.id) } },
  })

  const updatedBlueprint = await db.projectBlueprint.findUnique({
    where: { id: blueprint.id },
  })

  await db.blueprintVersion.create({
    data: {
      blueprintId: blueprint.id,
      version: 1,
      snapshot: {
        version: 1,
        createdAt: new Date().toISOString(),
        blueprint: {
          id: updatedBlueprint!.id,
          projectId: updatedBlueprint!.projectId,
          archetype: updatedBlueprint!.archetype,
          hierarchyLabels: updatedBlueprint!.hierarchyLabels,
          targetAudience: updatedBlueprint!.targetAudience,
          learningOutcomes: updatedBlueprint!.learningOutcomes,
          enabledComponents: updatedBlueprint!.enabledComponents,
          ideationPhase: updatedBlueprint!.ideationPhase,
          ideationScore: updatedBlueprint!.ideationScore,
          structureSummary: updatedBlueprint!.structureSummary,
        },
        nodes: allNodes.map(n => ({
          id: n.id,
          blueprintId: n.blueprintId,
          parentId: n.parentId,
          title: n.title,
          slug: n.slug,
          description: n.description,
          notes: n.notes,
          depth: n.depth,
          sortOrder: n.sortOrder,
          learningOutcomes: n.learningOutcomes,
          status: n.status,
          agentConfidence: n.agentConfidence,
          path: n.path,
        })),
        components: allComponents.map(c => ({
          id: c.id,
          nodeId: c.nodeId,
          componentType: c.componentType,
          config: c.config,
          priority: c.priority,
          status: c.status,
          relevanceScore: c.relevanceScore,
          pipelineJobId: c.pipelineJobId,
        })),
      },
      rubricScore: {
        overallScore,
        dimensionScores,
        recommendation: 'revise',
      },
    },
  })
  console.log(`  Created BlueprintVersion v1`)

  // 9. Summary
  console.log('\n✅ Seed complete!')
  console.log(`   Projects:       1`)
  console.log(`   Blueprints:     1`)
  console.log(`   Nodes:          ${nodeCount}`)
  console.log(`   Components:     ${componentCount}`)
  console.log(`   Conversations:  3 (brainstorm, structure, refinement)`)
  console.log(`   Messages:       ${totalMessages}`)
  console.log(`   StructureGrade: 1 (score: ${overallScore})`)
  console.log(`   Versions:       1`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
