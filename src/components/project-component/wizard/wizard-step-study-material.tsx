'use client'

import { useState, useCallback } from 'react'
import {
  BookOpen,
  Check,
  Loader2,
  Copy,
  FileText,
  Eye,
  BookMarked,
  Link2,
  GraduationCap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudyMaterialConfig {
  format: 'comprehensive' | 'summary' | 'reference_guide' | 'cheat_sheet'
  length: 'short_2_pages' | 'medium_5_pages' | 'detailed_10_pages'
  includeVisuals: boolean
  includeKeyTerms: boolean
  includeReferences: boolean
  readingLevel: 'elementary' | 'intermediate' | 'advanced' | 'professional'
}

export interface WizardStepStudyMaterialProps {
  blueprintId: string
  instanceCount: number
  initialConfig?: Partial<StudyMaterialConfig>
  onSave: (config: StudyMaterialConfig, applyToAll: boolean) => Promise<void>
}

const DEFAULT_CONFIG: StudyMaterialConfig = {
  format: 'comprehensive',
  length: 'medium_5_pages',
  includeVisuals: true,
  includeKeyTerms: true,
  includeReferences: true,
  readingLevel: 'intermediate',
}

const FORMAT_OPTIONS: { value: StudyMaterialConfig['format']; label: string; description: string }[] = [
  { value: 'comprehensive', label: 'Comprehensive', description: 'Full coverage with examples, diagrams, and exercises' },
  { value: 'summary', label: 'Summary', description: 'Key points and takeaways only' },
  { value: 'reference_guide', label: 'Reference Guide', description: 'Quick-lookup format with tables and lists' },
  { value: 'cheat_sheet', label: 'Cheat Sheet', description: 'One-page condensed overview' },
]

const LENGTH_OPTIONS: { value: StudyMaterialConfig['length']; label: string; pages: string }[] = [
  { value: 'short_2_pages', label: 'Short', pages: '~2 pages' },
  { value: 'medium_5_pages', label: 'Medium', pages: '~5 pages' },
  { value: 'detailed_10_pages', label: 'Detailed', pages: '~10 pages' },
]

const READING_LEVEL_OPTIONS: { value: StudyMaterialConfig['readingLevel']; label: string; description: string }[] = [
  { value: 'elementary', label: 'Elementary', description: 'Simple vocabulary, short sentences' },
  { value: 'intermediate', label: 'Intermediate', description: 'Standard academic language' },
  { value: 'advanced', label: 'Advanced', description: 'Technical terminology, complex concepts' },
  { value: 'professional', label: 'Professional', description: 'Industry jargon, expert-level depth' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepStudyMaterial({
  blueprintId,
  instanceCount,
  initialConfig,
  onSave,
}: WizardStepStudyMaterialProps) {
  const [config, setConfig] = useState<StudyMaterialConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })
  const [applyToAll, setApplyToAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateConfig = useCallback(<K extends keyof StudyMaterialConfig>(
    key: K,
    value: StudyMaterialConfig[K],
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
          <BookOpen size={18} />
          Study Material Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for {instanceCount} study material{instanceCount !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Format — visual cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <FileText size={14} />
            Format
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMAT_OPTIONS.map(opt => {
              const isSelected = config.format === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('format', opt.value)}
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

      {/* Length — segmented control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Length</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex rounded-lg border border-input p-0.5">
            {LENGTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateConfig('length', opt.value)}
                className={`
                  flex-1 rounded-md px-3 py-2 text-center transition-colors
                  ${config.length === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <p className="text-xs font-medium">{opt.label}</p>
                <p className={`text-[10px] ${config.length === opt.value ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {opt.pages}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardContent className="divide-y py-0">
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="visuals" className="flex items-center gap-2 text-sm font-normal">
              <Eye size={14} className="text-muted-foreground" />
              Include Visuals &amp; Diagrams
            </Label>
            <Switch
              id="visuals"
              checked={config.includeVisuals}
              onCheckedChange={v => updateConfig('includeVisuals', v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="key-terms" className="flex items-center gap-2 text-sm font-normal">
              <BookMarked size={14} className="text-muted-foreground" />
              Include Key Terms Glossary
            </Label>
            <Switch
              id="key-terms"
              checked={config.includeKeyTerms}
              onCheckedChange={v => updateConfig('includeKeyTerms', v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="references" className="flex items-center gap-2 text-sm font-normal">
              <Link2 size={14} className="text-muted-foreground" />
              Include References &amp; Citations
            </Label>
            <Switch
              id="references"
              checked={config.includeReferences}
              onCheckedChange={v => updateConfig('includeReferences', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reading Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <GraduationCap size={14} />
            Reading Level
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {READING_LEVEL_OPTIONS.map(opt => {
              const isSelected = config.readingLevel === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('readingLevel', opt.value)}
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
            <Label htmlFor="apply-all-sm" className="flex items-center gap-2 text-sm font-normal">
              <Copy size={14} className="text-muted-foreground" />
              Apply to all {instanceCount} study material{instanceCount !== 1 ? 's' : ''}
            </Label>
            <Switch
              id="apply-all-sm"
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
          {saving ? 'Saving...' : 'Save Study Material Settings'}
        </Button>
      </div>
    </div>
  )
}
