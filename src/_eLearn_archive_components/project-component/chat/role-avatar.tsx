import {
  Users,
  Compass,
  Search,
  GraduationCap,
  UserCheck,
  LayoutGrid,
  Palette,
  AlertTriangle,
  Layers,
} from 'lucide-react'
import type { BrainstormRole } from '@/lib/domain/workflows'

const ROLE_CONFIG: Record<BrainstormRole, {
  icon: typeof Users
  label: string
  color: string
}> = {
  human: {
    icon: Users,
    label: 'You',
    color: 'bg-primary text-primary-foreground',
  },
  facilitator: {
    icon: Compass,
    label: 'Facilitator',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  researcher: {
    icon: Search,
    label: 'Researcher',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  },
  pedagogy_expert: {
    icon: GraduationCap,
    label: 'Pedagogy Expert',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  audience_analyst: {
    icon: UserCheck,
    label: 'Audience Analyst',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  structure_architect: {
    icon: LayoutGrid,
    label: 'Structure Architect',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  },
  creative_director: {
    icon: Palette,
    label: 'Creative Director',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  },
  critic: {
    icon: AlertTriangle,
    label: 'Critic',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  synthesizer: {
    icon: Layers,
    label: 'Synthesizer',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  },
}

export function getRoleConfig(role: BrainstormRole) {
  return ROLE_CONFIG[role]
}

export function RoleAvatar({ role, size = 'sm' }: { role: BrainstormRole; size?: 'sm' | 'md' }) {
  const config = ROLE_CONFIG[role]
  const Icon = config.icon
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 14 : 18

  return (
    <div
      className={`${sizeClass} ${config.color} flex shrink-0 items-center justify-center rounded-full`}
      title={config.label}
    >
      <Icon size={iconSize} />
    </div>
  )
}
