/**
 * Component Registry — defines all 16 component types available in the platform.
 *
 * Each component defines what it produces, how it's built, estimated costs,
 * where it can attach in the tree, and its dependencies on other components.
 */

import type { ComponentCategory, ComponentDefinition } from './types'

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // ─── Content (5) ───────────────────────────────────────────────────────────

  video: {
    id: 'video',
    name: 'Educational Video',
    description: 'Full-length scripted, narrated, and animated educational video with captions and thumbnails.',
    icon: 'Video',
    category: 'content',
    deliverableType: 'video',
    deliverableFormat: ['mp4', 'srt', 'json'],
    pipelineType: 'video',
    estimatedProductionTime: '45-90 min',
    estimatedCost: { min: 3.00, max: 12.00, currency: 'USD' },
    configSchema: {
      defaults: {
        duration: '8-12 min',
        resolution: '1920x1080',
        fps: 30,
        voiceProvider: 'elevenlabs',
        imageProvider: 'fal',
        musicEnabled: true,
        captionsEnabled: true,
      },
    },
    attachableAt: [2, 3],
    maxPerNode: 1,
    required: false,
    dependsOn: [],
    produces: ['mp4', 'srt', 'thumbnail_jpg', 'metadata_json'],
  },

  video_short: {
    id: 'video_short',
    name: 'Short-Form Video',
    description: 'Brief explainer or recap video under 3 minutes. Optimized for social media and quick review.',
    icon: 'Clapperboard',
    category: 'content',
    deliverableType: 'video',
    deliverableFormat: ['mp4', 'srt'],
    pipelineType: 'video',
    estimatedProductionTime: '20-40 min',
    estimatedCost: { min: 1.50, max: 5.00, currency: 'USD' },
    configSchema: {
      defaults: {
        duration: '1-3 min',
        resolution: '1080x1920',
        fps: 30,
        voiceProvider: 'elevenlabs',
        captionsEnabled: true,
      },
    },
    attachableAt: [2, 3],
    maxPerNode: 3,
    required: false,
    dependsOn: [],
    produces: ['mp4', 'srt'],
  },

  study_material: {
    id: 'study_material',
    name: 'Study Material',
    description: 'Comprehensive reading material with sections, key terms, diagrams, and examples. The textual foundation for all other components.',
    icon: 'BookOpen',
    category: 'content',
    deliverableType: 'document',
    deliverableFormat: ['pdf', 'html', 'json'],
    pipelineType: 'document',
    estimatedProductionTime: '15-30 min',
    estimatedCost: { min: 0.50, max: 2.00, currency: 'USD' },
    configSchema: {
      defaults: {
        readingLevel: 'intermediate',
        includeKeyTerms: true,
        includeDiagrams: true,
        includeExamples: true,
        format: 'pdf',
      },
    },
    attachableAt: [1, 2, 3],
    maxPerNode: 1,
    required: false,
    dependsOn: [],
    produces: ['pdf', 'html', 'key_terms_json'],
  },

  practice_worksheet: {
    id: 'practice_worksheet',
    name: 'Practice Worksheet',
    description: 'Structured practice problems with worked examples and answer key. Designed for guided or independent practice.',
    icon: 'ClipboardList',
    category: 'content',
    deliverableType: 'document',
    deliverableFormat: ['pdf'],
    pipelineType: 'document',
    estimatedProductionTime: '10-20 min',
    estimatedCost: { min: 0.30, max: 1.00, currency: 'USD' },
    configSchema: {
      defaults: {
        problemCount: 10,
        includeWorkedExamples: true,
        includeAnswerKey: true,
        difficultyProgression: true,
      },
    },
    attachableAt: [2, 3],
    maxPerNode: 3,
    required: false,
    dependsOn: ['study_material'],
    produces: ['pdf'],
  },

  flashcards: {
    id: 'flashcards',
    name: 'Flashcard Set',
    description: 'Digital flashcards for key terms, definitions, and concept review. Supports spaced repetition.',
    icon: 'Layers',
    category: 'content',
    deliverableType: 'document',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'document',
    estimatedProductionTime: '5-10 min',
    estimatedCost: { min: 0.15, max: 0.50, currency: 'USD' },
    configSchema: {
      defaults: {
        cardCount: 20,
        includeImages: false,
        format: 'json',
      },
    },
    attachableAt: [1, 2, 3],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material'],
    produces: ['json', 'pdf'],
  },

  // ─── Assessment (3) ────────────────────────────────────────────────────────

  quiz: {
    id: 'quiz',
    name: 'Quiz',
    description: 'Formative assessment with multiple question types aligned to learning outcomes. Includes answer key and explanations.',
    icon: 'HelpCircle',
    category: 'assessment',
    deliverableType: 'assessment',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'assessment',
    estimatedProductionTime: '15-25 min',
    estimatedCost: { min: 0.40, max: 1.50, currency: 'USD' },
    configSchema: {
      defaults: {
        questionCount: 10,
        questionTypes: ['mcq', 'true_false', 'fill_blank'],
        bloomDistribution: { remember: 0.2, understand: 0.3, apply: 0.3, analyze: 0.2 },
        passingScore: 70,
        timeLimit: null,
        shuffleQuestions: true,
      },
    },
    attachableAt: [1, 2, 3],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material'],
    produces: ['quiz_json', 'answer_key_json', 'pdf'],
  },

  pre_assessment: {
    id: 'pre_assessment',
    name: 'Pre-Assessment',
    description: 'Diagnostic assessment administered before instruction to gauge baseline knowledge and identify gaps.',
    icon: 'ClipboardCheck',
    category: 'assessment',
    deliverableType: 'assessment',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'assessment',
    estimatedProductionTime: '15-25 min',
    estimatedCost: { min: 0.40, max: 1.50, currency: 'USD' },
    configSchema: {
      defaults: {
        questionCount: 15,
        questionTypes: ['mcq', 'true_false'],
        bloomDistribution: { remember: 0.4, understand: 0.4, apply: 0.2 },
        timeLimit: 20,
      },
    },
    attachableAt: [1],
    maxPerNode: 1,
    required: false,
    dependsOn: [],
    produces: ['quiz_json', 'answer_key_json', 'pdf'],
  },

  post_assessment: {
    id: 'post_assessment',
    name: 'Post-Assessment',
    description: 'Summative assessment administered after instruction to measure learning gains against pre-assessment baseline.',
    icon: 'Award',
    category: 'assessment',
    deliverableType: 'assessment',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'assessment',
    estimatedProductionTime: '15-25 min',
    estimatedCost: { min: 0.40, max: 1.50, currency: 'USD' },
    configSchema: {
      defaults: {
        questionCount: 20,
        questionTypes: ['mcq', 'true_false', 'short_answer', 'scenario'],
        bloomDistribution: { remember: 0.1, understand: 0.2, apply: 0.3, analyze: 0.2, evaluate: 0.2 },
        passingScore: 70,
        timeLimit: 30,
      },
    },
    attachableAt: [1],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material'],
    produces: ['quiz_json', 'answer_key_json', 'pdf'],
  },

  // ─── Activity (3) ──────────────────────────────────────────────────────────

  activity: {
    id: 'activity',
    name: 'Learning Activity',
    description: 'Guided practice activity with instructions, materials, and facilitator notes. Supports individual, pair, or group work.',
    icon: 'Puzzle',
    category: 'activity',
    deliverableType: 'activity',
    deliverableFormat: ['pdf', 'html'],
    pipelineType: 'activity',
    estimatedProductionTime: '20-35 min',
    estimatedCost: { min: 0.60, max: 2.00, currency: 'USD' },
    configSchema: {
      defaults: {
        activityType: 'guided_practice',
        duration: '30 min',
        groupSize: 'individual',
        includeExemplar: true,
        includeFacilitatorNotes: true,
        scaffoldingLevel: 'moderate',
      },
    },
    attachableAt: [1, 2, 3],
    maxPerNode: 3,
    required: false,
    dependsOn: ['study_material'],
    produces: ['activity_guide_pdf', 'facilitator_notes_pdf'],
  },

  scenario_exercise: {
    id: 'scenario_exercise',
    name: 'Scenario Exercise',
    description: 'Case study or simulation-based exercise where learners apply knowledge to realistic situations. Includes debrief guide.',
    icon: 'Route',
    category: 'activity',
    deliverableType: 'activity',
    deliverableFormat: ['pdf', 'html'],
    pipelineType: 'activity',
    estimatedProductionTime: '25-45 min',
    estimatedCost: { min: 0.80, max: 2.50, currency: 'USD' },
    configSchema: {
      defaults: {
        scenarioType: 'case_study',
        complexity: 'moderate',
        includeRoleCards: true,
        includeDebriefGuide: true,
        decisionPoints: 3,
      },
    },
    attachableAt: [1, 2],
    maxPerNode: 2,
    required: false,
    dependsOn: ['study_material'],
    produces: ['scenario_pdf', 'debrief_guide_pdf'],
  },

  capstone_project: {
    id: 'capstone_project',
    name: 'Capstone Project',
    description: 'Culminating project that synthesizes learning across a module or course. Includes brief, rubric, checkpoints, and optional exemplar.',
    icon: 'Trophy',
    category: 'activity',
    deliverableType: 'activity',
    deliverableFormat: ['pdf', 'json'],
    pipelineType: 'capstone',
    estimatedProductionTime: '30-60 min',
    estimatedCost: { min: 1.00, max: 3.50, currency: 'USD' },
    configSchema: {
      defaults: {
        duration: '1-2 weeks',
        deliverableCount: 3,
        checkpointCount: 3,
        includeExemplar: true,
        includePeerReviewTemplate: true,
        includeMentorChecklist: true,
      },
    },
    attachableAt: [0, 1],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material', 'quiz'],
    produces: ['project_brief_pdf', 'rubric_json', 'checkpoint_schedule_json', 'exemplar_pdf'],
  },

  // ─── Meta (5) ──────────────────────────────────────────────────────────────

  discussion_prompt: {
    id: 'discussion_prompt',
    name: 'Discussion Prompt',
    description: 'Guided discussion questions with facilitator guide and conversation starters. For classroom or online forums.',
    icon: 'MessageSquare',
    category: 'meta',
    deliverableType: 'document',
    deliverableFormat: ['pdf', 'json'],
    pipelineType: 'document',
    estimatedProductionTime: '5-15 min',
    estimatedCost: { min: 0.15, max: 0.50, currency: 'USD' },
    configSchema: {
      defaults: {
        promptCount: 5,
        includeFollowUps: true,
        includeFacilitatorGuide: true,
        discussionFormat: 'open_ended',
      },
    },
    attachableAt: [1, 2, 3],
    maxPerNode: 2,
    required: false,
    dependsOn: ['study_material'],
    produces: ['discussion_pdf', 'facilitator_guide_pdf'],
  },

  glossary: {
    id: 'glossary',
    name: 'Glossary',
    description: 'Auto-generated glossary of key terms and definitions extracted from study materials across the project.',
    icon: 'BookA',
    category: 'meta',
    deliverableType: 'document',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'meta',
    estimatedProductionTime: '3-8 min',
    estimatedCost: { min: 0.10, max: 0.30, currency: 'USD' },
    configSchema: {
      defaults: {
        includeExamples: true,
        includeRelatedTerms: true,
        sortOrder: 'alphabetical',
      },
    },
    attachableAt: [0, 1],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material'],
    produces: ['glossary_json', 'glossary_pdf'],
  },

  resource_library: {
    id: 'resource_library',
    name: 'Resource Library',
    description: 'Curated collection of external links, references, and supplementary materials organized by topic.',
    icon: 'Library',
    category: 'meta',
    deliverableType: 'document',
    deliverableFormat: ['json', 'pdf'],
    pipelineType: 'meta',
    estimatedProductionTime: '5-15 min',
    estimatedCost: { min: 0.15, max: 0.50, currency: 'USD' },
    configSchema: {
      defaults: {
        resourceCount: 10,
        includeDescriptions: true,
        categorizeByTopic: true,
        includeDifficultyLevel: true,
      },
    },
    attachableAt: [0, 1],
    maxPerNode: 1,
    required: false,
    dependsOn: [],
    produces: ['resource_library_json', 'resource_library_pdf'],
  },

  certificate: {
    id: 'certificate',
    name: 'Certificate of Completion',
    description: 'Customizable completion certificate template with course name, learner name placeholder, and achievement criteria.',
    icon: 'GraduationCap',
    category: 'meta',
    deliverableType: 'document',
    deliverableFormat: ['pdf', 'svg'],
    pipelineType: 'meta',
    estimatedProductionTime: '5-10 min',
    estimatedCost: { min: 0.10, max: 0.30, currency: 'USD' },
    configSchema: {
      defaults: {
        style: 'professional',
        includeSignature: true,
        includeDate: true,
        includeCredentialId: true,
      },
    },
    attachableAt: [0],
    maxPerNode: 1,
    required: false,
    dependsOn: [],
    produces: ['certificate_pdf', 'certificate_svg'],
  },

  mentor_checklist: {
    id: 'mentor_checklist',
    name: 'Mentor / Facilitator Checklist',
    description: 'Observation criteria, conversation starters, and progress checkpoints for mentors and facilitators guiding learners.',
    icon: 'ListChecks',
    category: 'meta',
    deliverableType: 'document',
    deliverableFormat: ['pdf', 'json'],
    pipelineType: 'document',
    estimatedProductionTime: '5-15 min',
    estimatedCost: { min: 0.15, max: 0.50, currency: 'USD' },
    configSchema: {
      defaults: {
        checkpointCount: 5,
        includeConversationStarters: true,
        includeObservationCriteria: true,
        includeProgressIndicators: true,
      },
    },
    attachableAt: [0, 1],
    maxPerNode: 1,
    required: false,
    dependsOn: ['study_material'],
    produces: ['checklist_pdf', 'checklist_json'],
  },
}

/** Get a component definition by type. Returns undefined if not found. */
export function getComponent(type: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY[type]
}

/** List all component definitions, optionally filtered by category. */
export function listComponents(category?: ComponentCategory): ComponentDefinition[] {
  const all = Object.values(COMPONENT_REGISTRY)
  if (!category) return all
  return all.filter(c => c.category === category)
}

/** Get components that can be attached at a given tree depth. */
export function getComponentsForLevel(depth: number): ComponentDefinition[] {
  return Object.values(COMPONENT_REGISTRY).filter(c => c.attachableAt.includes(depth))
}
