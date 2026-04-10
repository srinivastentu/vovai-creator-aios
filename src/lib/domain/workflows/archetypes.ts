/**
 * Archetype Registry — defines the 3 supported project archetypes.
 *
 * Each archetype determines:
 * - Hierarchy structure (how the project tree is labeled)
 * - Default and available components
 * - Production mode (batch, sequential, rolling)
 */

import type { ArchetypeDefinition, ProjectArchetype } from './types'

export const PROJECT_ARCHETYPES: Record<ProjectArchetype, ArchetypeDefinition> = {
  k12_curriculum: {
    id: 'k12_curriculum',
    name: 'K-12 Curriculum-Aligned Course',
    description:
      'Structured curriculum following national/state standards. Organized by subject, grade, chapter, and topic with batch production for efficiency.',
    hierarchy: {
      0: 'Subject',
      1: 'Grade',
      2: 'Chapter',
      3: 'Topic',
      4: 'Sub-topic',
    },
    maxDepth: 4,
    defaultComponents: ['video'],
    availableComponents: [
      'video',
      'study_material',
      'quiz',
      'practice_worksheet',
      'flashcards',
    ],
    productionMode: 'batch',
  },

  professional_training: {
    id: 'professional_training',
    name: 'Professional Training Course',
    description:
      'Comprehensive training program with study materials, assessments, activities, and capstone projects. Produced module-by-module to maintain content coherence.',
    hierarchy: {
      0: 'Course',
      1: 'Module',
      2: 'Topic',
      3: 'Subtopic',
    },
    maxDepth: 3,
    defaultComponents: [
      'video',
      'study_material',
      'quiz',
      'activity',
      'capstone_project',
    ],
    availableComponents: [
      'video',
      'video_short',
      'study_material',
      'practice_worksheet',
      'flashcards',
      'quiz',
      'pre_assessment',
      'post_assessment',
      'activity',
      'scenario_exercise',
      'capstone_project',
      'discussion_prompt',
      'glossary',
      'resource_library',
      'certificate',
      'mentor_checklist',
    ],
    productionMode: 'module_sequential',
  },

  content_channel: {
    id: 'content_channel',
    name: 'Content Channel / Ongoing Production',
    description:
      'Ongoing content production organized by subject and season. Episodes are produced on a rolling basis for continuous publishing.',
    hierarchy: {
      0: 'Channel',
      1: 'Subject',
      2: 'Season',
      3: 'Episode',
    },
    maxDepth: 3,
    defaultComponents: ['video'],
    availableComponents: [
      'video',
      'video_short',
      'study_material',
      'quiz',
    ],
    productionMode: 'rolling',
  },
}

/** Get an archetype definition by ID. Throws if not found. */
export function getArchetype(id: string): ArchetypeDefinition {
  const archetype = PROJECT_ARCHETYPES[id as ProjectArchetype]
  if (!archetype) {
    throw new Error(`Unknown archetype: "${id}". Valid: ${Object.keys(PROJECT_ARCHETYPES).join(', ')}`)
  }
  return archetype
}

/** List all registered archetype definitions. */
export function listArchetypes(): ArchetypeDefinition[] {
  return Object.values(PROJECT_ARCHETYPES)
}
