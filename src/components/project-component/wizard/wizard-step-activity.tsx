'use client'

import { useState, useCallback } from 'react'
import {
  Puzzle,
  Check,
  Loader2,
  Copy,
  Clock,
  Users,
  Layers,
  Award,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActivityConfig {
  activityType: string
  duration: number
  groupSize: 'individual' | 'pairs' | 'small_group' | 'large_group'
  scaffoldingLevel: 'high' | 'medium' | 'low' | 'none'
  includeRubric: boolean
  includeExemplar: boolean
}

export interface WizardStepActivityProps {
  blueprintId: string
  instanceCount: number
  initialConfig?: Partial<ActivityConfig>
  onSave: (config: ActivityConfig, applyToAll: boolean) => Promise<void>
}

const DEFAULT_CONFIG: ActivityConfig = {
  activityType: 'guided_practice',
  duration: 30,
  groupSize: 'individual',
  scaffoldingLevel: 'medium',
  includeRubric: true,
  includeExemplar: true,
}

const ACTIVITY_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'guided_practice', label: 'Guided Practice', description: 'Step-by-step structured exercises with support' },
  { value: 'case_study', label: 'Case Study', description: 'Real-world scenario analysis and discussion' },
  { value: 'simulation', label: 'Simulation', description: 'Interactive role-play or simulated environment' },
  { value: 'project_based', label: 'Project-Based', description: 'Create a deliverable applying learned concepts' },
  { value: 'debate', label: 'Debate / Discussion', description: 'Structured argumentation on a topic' },
  { value: 'peer_review', label: 'Peer Review', description: 'Evaluate and provide feedback on peer work' },
]

const GROUP_SIZE_OPTIONS: { value: ActivityConfig['groupSize']; label: string; icon: string }[] = [
  { value: 'individual', label: 'Individual', icon: '1' },
  { value: 'pairs', label: 'Pairs', icon: '2' },
  { value: 'small_group', label: 'Small Group', icon: '3-5' },
  { value: 'large_group', label: 'Large Group', icon: '6+' },
]

const SCAFFOLDING_OPTIONS: { value: ActivityConfig['scaffoldingLevel']; label: string; description: string }[] = [
  { value: 'high', label: 'High', description: 'Detailed step-by-step guidance' },
  { value: 'medium', label: 'Medium', description: 'Key prompts and hints provided' },
  { value: 'low', label: 'Low', description: 'Minimal guidance, mostly self-directed' },
  { value: 'none', label: 'None', description: 'Fully independent, open-ended' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepActivity({
  blueprintId,
  instanceCount,
  initialConfig,
  onSave,
}: WizardStepActivityProps) {
  const [config, setConfig] = useState<ActivityConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })
  const [applyToAll, setApplyToAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateConfig = useCallback(<K extends keyof ActivityConfig>(
    key: K,
    value: ActivityConfig[K],
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(config, applyToAll)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }, [config, applyToAll, onSave])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Puzzle size={18} />
          Activity Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for {instanceCount} activit{instanceCount !== 1 ? 'ies' : 'y'}.
        </p>
      </div>

      {/* Activity Type — visual cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Activity Type</CardTitle>
          <CardDescription className="text-xs">Choose the primary format</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIVITY_TYPES.map(opt => {
              const isSelected = config.activityType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('activityType', opt.value)}
                  className={`
                    rounded-lg border p-3 text-left transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <p className={`text-xs font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {opt.label}
                  </p>
                  <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Duration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Clock size={14} />
            Duration
          </CardTitle>
          <CardDescription className="text-xs">15 – 120 minutes</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Slider
            value={config.duration}
            onValueChange={v => updateConfig('duration', v)}
            min={15}
            max={120}
            step={5}
            suffix=" min"
          />
        </CardContent>
      </Card>

      {/* Group Size — segmented control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Users size={14} />
            Group Size
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex rounded-lg border border-input p-0.5">
            {GROUP_SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateConfig('groupSize', opt.value)}
                className={`
                  flex-1 rounded-md px-2 py-2 text-center transition-colors
                  ${config.groupSize === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <p className="text-xs font-medium">{opt.label}</p>
                <p className={`text-[10px] ${config.groupSize === opt.value ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {opt.icon}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scaffolding Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Layers size={14} />
            Scaffolding Level
          </CardTitle>
          <CardDescription className="text-xs">How much guidance learners receive</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {SCAFFOLDING_OPTIONS.map(opt => {
              const isSelected = config.scaffoldingLevel === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('scaffoldingLevel', opt.value)}
                  className={`
                    rounded-lg border p-3 text-left transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <p className={`text-xs font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {opt.label}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardContent className="divide-y py-0">
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="rubric" className="flex items-center gap-2 text-sm font-normal">
              <Award size={14} className="text-muted-foreground" />
              Include Grading Rubric
            </Label>
            <Switch
              id="rubric"
              checked={config.includeRubric}
              onCheckedChange={v => updateConfig('includeRubric', v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="exemplar" className="flex items-center gap-2 text-sm font-normal">
              <FileCheck size={14} className="text-muted-foreground" />
              Include Exemplar (Sample Answer)
            </Label>
            <Switch
              id="exemplar"
              checked={config.includeExemplar}
              onCheckedChange={v => updateConfig('includeExemplar', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Apply to all */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="apply-all-act" className="flex items-center gap-2 text-sm font-normal">
              <Copy size={14} className="text-muted-foreground" />
              Apply to all {instanceCount} activit{instanceCount !== 1 ? 'ies' : 'y'}
            </Label>
            <Switch
              id="apply-all-act"
              checked={applyToAll}
              onCheckedChange={setApplyToAll}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check size={14} />
            Saved
          </span>
        )}
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Activity Settings'}
        </Button>
      </div>
    </div>
  )
}
