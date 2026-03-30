import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeIdeationAgent } from '@/lib/project-component/agents/framework/executor'

/**
 * POST /api/blueprints/[blueprintId]/ideation/ask
 *
 * Lightweight Q&A endpoint for the agent chat drawer.
 * Sends the user's question to Claude with the current structure as context.
 * Does NOT run the full ideation loop or mutate any state.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()
    const question = body.message?.trim()

    if (!question) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Load blueprint with nodes
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
      include: {
        project: { select: { name: true, topic: true, targetAudience: true } },
      },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Load nodes to build structure context
    const nodes = await db.projectNode.findMany({
      where: { blueprintId },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      include: { components: { select: { componentType: true, priority: true } } },
    })

    // Load latest grade
    const grade = await db.structureGrade.findFirst({
      where: { blueprintId },
      orderBy: { createdAt: 'desc' },
    })

    // Build a text summary of the structure for context
    const structureContext = buildStructureContext(blueprint, nodes, grade)

    const systemPrompt = `You are a helpful structure advisor for an eLearning project. You answer questions about the project's structure — its modules, topics, components, balance, and quality.

Be concise and specific. Reference actual module/topic names and scores when relevant. If the user asks about improving something, give actionable suggestions.

Here is the current project structure:

${structureContext}`

    const result = await executeIdeationAgent<string>(
      {
        id: 'structure-advisor',
        name: 'Structure Advisor',
        tier: 'governance',
        model: {
          primary: 'claude-sonnet-4-20250514',
          fallback: 'claude-haiku-4-5-20251001',
        },
        maxRetries: 1,
        timeoutMs: 30_000,
      },
      systemPrompt,
      question,
    )

    if (!result.success) {
      return NextResponse.json({
        answer: result.error ?? 'Sorry, I could not process your question right now.',
        costUSD: 0,
      })
    }

    const answer = typeof result.output === 'string'
      ? result.output
      : JSON.stringify(result.output)

    return NextResponse.json({
      answer,
      costUSD: result.costUSD,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/ask error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface NodeWithComponents {
  id: string
  title: string
  description: string | null
  depth: number
  parentId: string | null
  learningOutcomes: unknown
  components: Array<{ componentType: string; priority: string }>
}

function buildStructureContext(
  blueprint: {
    archetype: string | null
    ideationPhase: string
    ideationScore: number | null
    project: { name: string; topic: string; targetAudience: string }
  },
  nodes: NodeWithComponents[],
  grade: {
    overallScore: number
    dimensionScores: unknown
    recommendation: string
    feedback: string | null
  } | null,
): string {
  const lines: string[] = []

  lines.push(`Project: ${blueprint.project.name}`)
  lines.push(`Topic: ${blueprint.project.topic}`)
  lines.push(`Audience: ${blueprint.project.targetAudience}`)
  lines.push(`Archetype: ${blueprint.archetype ?? 'unknown'}`)
  lines.push(`Phase: ${blueprint.ideationPhase}`)
  lines.push('')

  // Build hierarchy
  const depthLabels = ['Module', 'Topic', 'Subtopic']
  for (const node of nodes) {
    const indent = '  '.repeat(node.depth)
    const label = depthLabels[node.depth] ?? `Depth ${node.depth}`
    const components = node.components.map(c => c.componentType).join(', ')
    lines.push(`${indent}${label}: ${node.title}${components ? ` [${components}]` : ''}`)
    if (node.description) {
      lines.push(`${indent}  ${node.description}`)
    }
    const outcomes = node.learningOutcomes as Array<{ text: string }> | null
    if (outcomes && outcomes.length > 0) {
      lines.push(`${indent}  Outcomes: ${outcomes.map(o => o.text).join('; ')}`)
    }
  }

  // Grade info
  if (grade) {
    lines.push('')
    lines.push(`Grade: ${grade.overallScore}/100 — Recommendation: ${grade.recommendation}`)
    const dims = grade.dimensionScores as Array<{ name: string; score: number; passThreshold: number; feedback: string }>
    if (dims) {
      for (const d of dims) {
        const status = d.score < d.passThreshold ? 'FAILING' : 'passing'
        lines.push(`  ${d.name}: ${d.score} (threshold: ${d.passThreshold}, ${status}) — ${d.feedback}`)
      }
    }
    if (grade.feedback) {
      lines.push(`Overall feedback: ${grade.feedback}`)
    }
  }

  // Stats
  const modules = nodes.filter(n => n.depth === 0)
  const topics = nodes.filter(n => n.depth === 1)
  const subtopics = nodes.filter(n => n.depth >= 2)
  const totalComponents = nodes.reduce((sum, n) => sum + n.components.length, 0)
  lines.push('')
  lines.push(`Stats: ${modules.length} modules, ${topics.length} topics, ${subtopics.length} subtopics, ${totalComponents} components`)

  // Per-module topic counts for balance analysis
  for (const mod of modules) {
    const modTopics = topics.filter(t => t.parentId === mod.id)
    const modComps = nodes.filter(n => n.parentId === mod.id || modTopics.some(t => t.id === n.parentId))
      .reduce((sum, n) => sum + n.components.length, 0)
    lines.push(`  ${mod.title}: ${modTopics.length} topics, ${modComps} components`)
  }

  return lines.join('\n')
}
