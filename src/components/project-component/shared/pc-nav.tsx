'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lightbulb, Network, Settings, Rocket } from 'lucide-react'
import type { IdeationPhase } from '@/lib/project-component'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavTab {
  key: string
  label: string
  href: (projectId: string) => string
  icon: React.ComponentType<{ size: number; className?: string }>
  /** Minimum ideation phase required to enable this tab */
  minPhase: IdeationPhase
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER: IdeationPhase[] = [
  'brainstorm',
  'structure',
  'refinement',
  'review',
  'approved',
]

const TABS: NavTab[] = [
  {
    key: 'ideation',
    label: 'Ideation',
    href: (id) => `/project/${id}/ideation`,
    icon: Lightbulb,
    minPhase: 'brainstorm', // always available
  },
  {
    key: 'structure',
    label: 'Structure',
    href: (id) => `/project/${id}/structure`,
    icon: Network,
    minPhase: 'structure', // available once structure phase starts
  },
  {
    key: 'configure',
    label: 'Configure',
    href: (id) => `/project/${id}/configure`,
    icon: Settings,
    minPhase: 'approved', // only after blueprint is approved
  },
  {
    key: 'launch',
    label: 'Launch',
    href: (id) => `/project/${id}/launch`,
    icon: Rocket,
    minPhase: 'approved', // only after blueprint is approved
  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PcNavProps {
  projectId: string
  currentPhase: IdeationPhase
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PcNav({ projectId, currentPhase }: PcNavProps) {
  const pathname = usePathname()
  const currentPhaseIdx = PHASE_ORDER.indexOf(currentPhase)

  return (
    <nav className="flex items-center gap-1 border-b px-4">
      {TABS.map((tab) => {
        const href = tab.href(projectId)
        const isActive = pathname === href || pathname?.startsWith(href + '/')
        const minIdx = PHASE_ORDER.indexOf(tab.minPhase)
        const isEnabled = currentPhaseIdx >= minIdx
        const Icon = tab.icon

        if (!isEnabled) {
          return (
            <div
              key={tab.key}
              className="flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground/40"
              title={`Available after ${tab.minPhase} phase`}
            >
              <Icon size={14} className="opacity-40" />
              {tab.label}
            </div>
          )
        }

        return (
          <Link
            key={tab.key}
            href={href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
