/**
 * Shared icon map for the 16 component types.
 * Single source of truth — all UI files import from here.
 */

import {
  Video,
  Clapperboard,
  BookOpen,
  ClipboardList,
  Layers,
  HelpCircle,
  ClipboardCheck,
  Award,
  Puzzle,
  Route,
  Trophy,
  MessageSquare,
  BookA,
  Library,
  GraduationCap,
  ListChecks,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Map of component type ID → LucideIcon */
export const COMPONENT_ICONS: Record<string, LucideIcon> = {
  video: Video,
  video_short: Clapperboard,
  study_material: BookOpen,
  practice_worksheet: ClipboardList,
  flashcards: Layers,
  quiz: HelpCircle,
  pre_assessment: ClipboardCheck,
  post_assessment: Award,
  activity: Puzzle,
  scenario_exercise: Route,
  capstone_project: Trophy,
  discussion_prompt: MessageSquare,
  glossary: BookA,
  resource_library: Library,
  certificate: GraduationCap,
  mentor_checklist: ListChecks,
}

/** Fallback icon for unknown component types */
export const COMPONENT_ICON_FALLBACK: LucideIcon = Package
