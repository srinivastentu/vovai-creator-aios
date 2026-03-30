'use client'

import { useMemo } from 'react'
import {
  Check,
  ClipboardList,
  Settings,
  Video,
  Clapperboard,
  BookOpen,
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
  ChevronRight,
  ChevronLeft,
  ListOrdered,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComponentDefinition, WorkflowTemplate } from '@/lib/project-component'

// ─── Icon Map ────────────────────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, LucideIcon> = {
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardStep {
  id: string
  label: string
  icon: LucideIcon
  componentType?: string
  instanceCount?: number
}

export interface WizardStepperProps {
  steps: WizardStep[]
  currentStep: number
  onStepClick: (stepIndex: number) => void
  onNext: () => void
  onPrevious: () => void
}

// ─── Step Generator ──────────────────────────────────────────────────────────

/**
 * Generate wizard steps from enabled component types and their instance counts.
 * Always includes Overview (first), Production Workflow (second),
 * and Review & Confirm (last). Component config steps follow the
 * production order from the workflow template when available.
 */
export function generateWizardSteps(
  enabledComponents: string[],
  componentDefs: ComponentDefinition[],
  componentCounts: Record<string, number>,
  workflowTemplate?: WorkflowTemplate | null,
): WizardStep[] {
  const steps: WizardStep[] = [
    { id: 'overview', label: 'Overview', icon: Settings },
    { id: 'workflow', label: 'Production Workflow', icon: ListOrdered },
  ]

  // Use production order from workflow template if available, else enabledComponents
  const ordering = workflowTemplate?.productionOrder ?? enabledComponents

  // One step per enabled component TYPE (ordered by production order)
  const defMap = new Map(componentDefs.map(d => [d.id, d]))
  for (const compType of ordering) {
    const def = defMap.get(compType)
    if (!def) continue
    const count = componentCounts[compType] ?? 0
    if (count === 0) continue
    const Icon = COMPONENT_ICONS[compType] ?? Package
    steps.push({
      id: compType,
      label: def.name,
      icon: Icon,
      componentType: compType,
      instanceCount: count,
    })
  }

  steps.push({ id: 'review', label: 'Review & Confirm', icon: Check })

  return steps
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
  onNext,
  onPrevious,
}: WizardStepperProps) {
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  return (
    <div className="flex flex-col gap-4">
      {/* Horizontal step indicator */}
      <div className="flex items-center overflow-x-auto px-1 py-2">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep
          const isClickable = idx < currentStep
          const Icon = step.icon

          return (
            <div key={step.id} className="flex items-center">
              {/* Step pill */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(idx)}
                disabled={!isClickable}
                className={`
                  flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                  ${isCurrent
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : isCompleted
                      ? 'cursor-pointer bg-primary/10 text-primary hover:bg-primary/20'
                      : 'cursor-default bg-muted text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check size={14} className="shrink-0" />
                ) : (
                  <Icon size={14} className="shrink-0" />
                )}
                <span className="hidden whitespace-nowrap sm:inline">{step.label}</span>
                {step.instanceCount !== undefined && (
                  <span className={`
                    rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none
                    ${isCurrent
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }
                  `}>
                    {step.instanceCount}
                  </span>
                )}
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className={`mx-1 h-px w-4 shrink-0 sm:w-6 ${
                  idx < currentStep ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={isFirst}
          className="gap-1.5"
        >
          <ChevronLeft size={14} />
          Previous
        </Button>

        <span className="text-xs text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </span>

        <Button
          size="sm"
          onClick={onNext}
          disabled={isLast}
          className="gap-1.5"
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}
