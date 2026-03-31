/**
 * Structure Materializer — converts ProposedStructure + ComponentPlan
 * from ideation messages into ProjectNode + NodeComponent database records.
 *
 * Called once when a blueprint is approved. Creates the full tree hierarchy
 * in a single transaction so handoff can find the nodes.
 *
 * Component attachment strategy:
 * 1. Match from componentPlan by title (normalized, case-insensitive)
 * 2. If no componentPlan or no match, assign archetype default components
 * 3. Subtopics get ZERO components (Principle #8)
 */

import { db } from '@/lib/db'
import { slugify } from '@/lib/validations/blueprint'
import { PROJECT_ARCHETYPES } from '../archetypes'
import type {
  ProposedStructure,
  ComponentPlan,
  ComponentRecommendation,
  ProjectArchetype,
} from '../types'

export interface MaterializeResult {
  nodesCreated: number
  componentsCreated: number
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function materializeStructure(
  blueprintId: string,
  structure: ProposedStructure,
  componentPlan: ComponentPlan | null,
  archetype: ProjectArchetype | null,
): Promise<MaterializeResult> {
  // Build a lookup: normalized title → component recommendations
  const componentsByTitle = new Map<string, ComponentRecommendation[]>()
  if (componentPlan) {
    for (const rec of componentPlan.nodeRecommendations) {
      componentsByTitle.set(normalizeTitle(rec.nodeTitle), rec.components)
    }
  }

  // Default components from archetype (applied to modules + topics only)
  const archetypeDef = archetype ? PROJECT_ARCHETYPES[archetype] : null
  const defaultComponentTypes = archetypeDef?.defaultComponents ?? ['video', 'study_material', 'quiz']

  // Module-only components: capstone attaches at module level, not every topic
  const MODULE_ONLY_COMPONENTS = ['capstone_project']
  const moduleOnlyDefaults = defaultComponentTypes.filter(c => MODULE_ONLY_COMPONENTS.includes(c))
  const topicDefaultTypes = defaultComponentTypes.filter(c => !MODULE_ONLY_COMPONENTS.includes(c))

  let nodesCreated = 0
  let componentsCreated = 0

  await db.$transaction(async (tx) => {
    // Clear any existing nodes for this blueprint (idempotent)
    await tx.projectNode.deleteMany({ where: { blueprintId } })

    for (let mi = 0; mi < structure.modules.length; mi++) {
      const mod = structure.modules[mi]
      const moduleSlug = slugify(mod.title)
      const modulePath = `/${moduleSlug}`

      const moduleNode = await tx.projectNode.create({
        data: {
          blueprintId,
          parentId: null,
          title: mod.title,
          slug: moduleSlug,
          description: mod.description,
          depth: 0,
          sortOrder: mi,
          path: modulePath,
          status: 'draft',
        },
      })
      nodesCreated++

      // Attach components to module: from componentPlan or archetype defaults
      const moduleComps = componentsByTitle.get(normalizeTitle(mod.title))
      const seenModuleTypes = new Set<string>()
      if (moduleComps && moduleComps.length > 0) {
        for (const comp of moduleComps) {
          if (seenModuleTypes.has(comp.componentType)) continue
          seenModuleTypes.add(comp.componentType)
          await tx.nodeComponent.create({
            data: {
              nodeId: moduleNode.id,
              componentType: comp.componentType,
              priority: comp.priority,
              status: 'planned',
            },
          })
          componentsCreated++
        }
      } else {
        // Apply archetype defaults
        for (const compType of defaultComponentTypes) {
          seenModuleTypes.add(compType)
          await tx.nodeComponent.create({
            data: {
              nodeId: moduleNode.id,
              componentType: compType,
              priority: 'core',
              status: 'planned',
            },
          })
          componentsCreated++
        }
      }
      // Ensure module-only defaults (e.g. capstone_project) are always present
      for (const compType of moduleOnlyDefaults) {
        if (seenModuleTypes.has(compType)) continue
        await tx.nodeComponent.create({
          data: {
            nodeId: moduleNode.id,
            componentType: compType,
            priority: 'core',
            status: 'planned',
          },
        })
        componentsCreated++
      }

      for (let ti = 0; ti < mod.topics.length; ti++) {
        const topic = mod.topics[ti]
        const topicSlug = slugify(topic.title)
        const topicPath = `${modulePath}/${topicSlug}`

        const topicNode = await tx.projectNode.create({
          data: {
            blueprintId,
            parentId: moduleNode.id,
            title: topic.title,
            slug: topicSlug,
            description: topic.description,
            depth: 1,
            sortOrder: ti,
            path: topicPath,
            status: 'draft',
          },
        })
        nodesCreated++

        // Attach components to topic: from componentPlan or archetype defaults
        // Deduplicate by componentType; exclude module-only types (e.g. capstone)
        const topicComps = componentsByTitle.get(normalizeTitle(topic.title))
        const seenTopicTypes = new Set<string>()
        if (topicComps && topicComps.length > 0) {
          for (const comp of topicComps) {
            if (seenTopicTypes.has(comp.componentType)) continue
            if (MODULE_ONLY_COMPONENTS.includes(comp.componentType)) continue
            seenTopicTypes.add(comp.componentType)
            await tx.nodeComponent.create({
              data: {
                nodeId: topicNode.id,
                componentType: comp.componentType,
                priority: comp.priority,
                status: 'planned',
              },
            })
            componentsCreated++
          }
        } else {
          // Apply archetype defaults (excluding module-only types)
          for (const compType of topicDefaultTypes) {
            await tx.nodeComponent.create({
              data: {
                nodeId: topicNode.id,
                componentType: compType,
                priority: 'core',
                status: 'planned',
              },
            })
            componentsCreated++
          }
        }

        // Subtopics (if present)
        if (topic.subtopics) {
          for (let si = 0; si < topic.subtopics.length; si++) {
            const subtopicTitle = topic.subtopics[si]
            const subtopicSlug = slugify(subtopicTitle)
            const subtopicPath = `${topicPath}/${subtopicSlug}`

            await tx.projectNode.create({
              data: {
                blueprintId,
                parentId: topicNode.id,
                title: subtopicTitle,
                slug: subtopicSlug,
                depth: 2,
                sortOrder: si,
                path: subtopicPath,
                status: 'draft',
              },
            })
            nodesCreated++
            // Subtopics have ZERO default components (Principle #8)
          }
        }
      }
    }
  })

  return { nodesCreated, componentsCreated }
}
