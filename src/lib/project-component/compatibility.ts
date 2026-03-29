/**
 * Component Compatibility Matrix — per-archetype component availability.
 *
 * Determines which components are recommended, optional, or unavailable
 * for each project archetype. Used by the configuration wizard to
 * guide component selection.
 */

import type { ProjectArchetype } from './types'

export interface CompatibilityEntry {
  recommended: string[]
  optional: string[]
  unavailable: string[]
}

export const COMPONENT_COMPATIBILITY: Record<ProjectArchetype, CompatibilityEntry> = {
  k12_curriculum: {
    recommended: ['video', 'quiz', 'practice_worksheet', 'flashcards'],
    optional: ['study_material', 'glossary', 'video_short'],
    unavailable: [
      'capstone_project',
      'scenario_exercise',
      'mentor_checklist',
      'certificate',
      'pre_assessment',
      'post_assessment',
      'activity',
      'discussion_prompt',
      'resource_library',
    ],
  },

  professional_training: {
    recommended: [
      'video',
      'study_material',
      'quiz',
      'activity',
      'capstone_project',
      'post_assessment',
    ],
    optional: [
      'pre_assessment',
      'scenario_exercise',
      'flashcards',
      'discussion_prompt',
      'glossary',
      'resource_library',
      'certificate',
      'mentor_checklist',
    ],
    unavailable: ['practice_worksheet', 'video_short'],
  },

  content_channel: {
    recommended: ['video'],
    optional: ['video_short', 'study_material', 'quiz'],
    unavailable: [
      'practice_worksheet',
      'flashcards',
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
  },
}

/** Get the compatibility entry for an archetype. Throws if archetype unknown. */
export function getCompatibleComponents(archetype: string): CompatibilityEntry {
  const entry = COMPONENT_COMPATIBILITY[archetype as ProjectArchetype]
  if (!entry) {
    throw new Error(`Unknown archetype: "${archetype}". Valid: ${Object.keys(COMPONENT_COMPATIBILITY).join(', ')}`)
  }
  return entry
}

/** Check if a component type is available (recommended or optional) for an archetype. */
export function isComponentAvailable(archetype: string, componentType: string): boolean {
  const entry = getCompatibleComponents(archetype)
  return entry.recommended.includes(componentType) || entry.optional.includes(componentType)
}
