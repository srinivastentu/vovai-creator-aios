'use client'

import { useState, useCallback } from 'react'
import {
  HelpCircle,
  Check,
  Loader2,
  Clock,
  Target,
  Copy,
  BarChart3,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizConfig {
  questionCount: number
  questionTypes: string[]
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  bloomLevels: string[]
  passingScore: number
  timeLimitEnabled: boolean
  timeLimitMinutes: number
  showFeedback: 'immediate' | 'after_submit' | 'never'
}

export interface WizardStepQuizProps {
  blueprintId: string
  instanceCount: number
  initialConfig?: Partial<QuizConfig>
  onSave: (config: QuizConfig, applyToAll: boolean) => Promise<void>
}

const DEFAULT_CONFIG: QuizConfig = {
  questionCount: 10,
  questionTypes: ['mcq', 'true_false', 'fill_blank'],
  difficulty: 'mixed',
  bloomLevels: ['remember', 'understand', 'apply'],
  passingScore: 70,
  timeLimitEnabled: false,
  timeLimitMinutes: 15,
  showFeedback: 'immediate',
}

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'matching', label: 'Matching' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'scenario', label: 'Scenario-Based' },
]

const BLOOM_LEVELS = [
  { value: 'remember', label: 'Remember', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'understand', label: 'Understand', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'apply', label: 'Apply', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'analyze', label: 'Analyze', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'evaluate', label: 'Evaluate', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'create', label: 'Create', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixed', label: 'Mixed' },
] as const

const FEEDBACK_OPTIONS = [
  { value: 'immediate', label: 'Immediate', description: 'Show after each question' },
  { value: 'after_submit', label: 'After Submit', description: 'Show when quiz is submitted' },
  { value: 'never', label: 'Never', description: 'No feedback shown' },
] as const

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepQuiz({
  blueprintId,
  instanceCount,
  initialConfig,
  onSave,
}: WizardStepQuizProps) {
  const [config, setConfig] = useState<QuizConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })
  const [applyToAll, setApplyToAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateConfig = useCallback(<K extends keyof QuizConfig>(
    key: K,
    value: QuizConfig[K],
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const toggleArrayItem = useCallback((key: 'questionTypes' | 'bloomLevels', item: string) => {
    setConfig(prev => {
      const arr = prev[key]
      const next = arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item]
      return { ...prev, [key]: next }
    })
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
          <HelpCircle size={18} />
          Quiz Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for {instanceCount} quiz{instanceCount !== 1 ? 'zes' : ''}.
        </p>
      </div>

      {/* Question Count */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Number of Questions</CardTitle>
          <CardDescription className="text-xs">3 – 50 questions per quiz</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Slider
            value={config.questionCount}
            onValueChange={v => updateConfig('questionCount', v)}
            min={3}
            max={50}
            step={1}
          />
        </CardContent>
      </Card>

      {/* Question Types — multi-select checkboxes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Question Types</CardTitle>
          <CardDescription className="text-xs">Select at least one type</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {QUESTION_TYPES.map(qt => {
              const isChecked = config.questionTypes.includes(qt.value)
              return (
                <button
                  key={qt.value}
                  type="button"
                  onClick={() => toggleArrayItem('questionTypes', qt.value)}
                  className={`
                    flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all
                    ${isChecked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40'
                    }
                  `}
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    }`}
                    aria-hidden
                  >
                    {isChecked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`font-medium ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {qt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Difficulty — radio-style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Target size={14} />
            Difficulty
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex rounded-lg border border-input p-0.5">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateConfig('difficulty', opt.value)}
                className={`
                  flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${config.difficulty === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bloom Levels — multi-select pills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <BarChart3 size={14} />
            Bloom&apos;s Taxonomy Levels
          </CardTitle>
          <CardDescription className="text-xs">
            Select which cognitive levels to target
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {BLOOM_LEVELS.map(bl => {
              const isSelected = config.bloomLevels.includes(bl.value)
              return (
                <button
                  key={bl.value}
                  type="button"
                  onClick={() => toggleArrayItem('bloomLevels', bl.value)}
                  className={`
                    rounded-full border px-3 py-1 text-xs font-medium transition-all
                    ${isSelected
                      ? `${bl.color} border-transparent`
                      : 'border-border text-muted-foreground hover:border-muted-foreground/60'
                    }
                  `}
                >
                  {bl.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Passing Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Passing Score</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Slider
            value={config.passingScore}
            onValueChange={v => updateConfig('passingScore', v)}
            min={0}
            max={100}
            step={5}
            suffix="%"
          />
        </CardContent>
      </Card>

      {/* Time Limit */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="time-limit" className="flex items-center gap-2 text-sm font-normal">
              <Clock size={14} className="text-muted-foreground" />
              Time Limit
            </Label>
            <Switch
              id="time-limit"
              checked={config.timeLimitEnabled}
              onCheckedChange={v => updateConfig('timeLimitEnabled', v)}
            />
          </div>
          {config.timeLimitEnabled && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={120}
                value={config.timeLimitMinutes}
                onChange={e => updateConfig('timeLimitMinutes', Math.max(1, Math.min(120, Number(e.target.value))))}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show Feedback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <MessageSquare size={14} />
            Answer Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-3">
            {FEEDBACK_OPTIONS.map(opt => {
              const isSelected = config.showFeedback === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('showFeedback', opt.value)}
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

      {/* Apply to all */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="apply-all-quiz" className="flex items-center gap-2 text-sm font-normal">
              <Copy size={14} className="text-muted-foreground" />
              Apply to all {instanceCount} quiz{instanceCount !== 1 ? 'zes' : ''}
            </Label>
            <Switch
              id="apply-all-quiz"
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
          {saving ? 'Saving...' : 'Save Quiz Settings'}
        </Button>
      </div>
    </div>
  )
}
