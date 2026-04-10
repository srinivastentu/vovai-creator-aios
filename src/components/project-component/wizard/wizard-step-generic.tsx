'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Settings,
  Check,
  Loader2,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import { Button } from '@/components/ui/button'
import { COMPONENT_ICONS, COMPONENT_ICON_FALLBACK } from '@/components/project-component/shared/component-icons'
import type { ComponentDefinition } from '@/lib/domain/workflows'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardStepGenericProps {
  blueprintId: string
  componentDef: ComponentDefinition
  instanceCount: number
  initialConfig?: Record<string, unknown>
  onSave: (config: Record<string, unknown>, applyToAll: boolean) => Promise<void>
}

/** Infer field type from a default value */
type FieldType = 'boolean' | 'number' | 'string' | 'enum' | 'array' | 'unknown'

interface FieldDescriptor {
  key: string
  label: string
  type: FieldType
  defaultValue: unknown
  /** For enum fields: the original string value is one of known options */
  enumOptions?: string[]
}

// Known enum values for common fields — allows us to render a select instead of text input
const KNOWN_ENUMS: Record<string, string[]> = {
  format: ['pdf', 'html', 'json', 'svg'],
  style: ['professional', 'casual', 'academic', 'modern', 'classic'],
  sortOrder: ['alphabetical', 'by_topic', 'by_frequency'],
  discussionFormat: ['open_ended', 'structured', 'socratic', 'fishbowl'],
  scenarioType: ['case_study', 'role_play', 'simulation', 'decision_tree'],
  complexity: ['simple', 'moderate', 'complex'],
  readingLevel: ['elementary', 'intermediate', 'advanced', 'professional'],
}

function inferFieldType(key: string, value: unknown): FieldType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'string') {
    if (KNOWN_ENUMS[key]) return 'enum'
    return 'string'
  }
  return 'unknown'
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

function extractFields(defaults: Record<string, unknown>): FieldDescriptor[] {
  return Object.entries(defaults).map(([key, value]) => ({
    key,
    label: humanizeKey(key),
    type: inferFieldType(key, value),
    defaultValue: value,
    enumOptions: KNOWN_ENUMS[key],
  }))
}

// ─── Field Renderers ────────────────────────────────────────────────────────

function BooleanField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <Label htmlFor={field.key} className="text-sm font-normal">
        {field.label}
      </Label>
      <Switch id={field.key} checked={value} onCheckedChange={onChange} />
    </div>
  )
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: number
  onChange: (v: number) => void
}) {
  // Use slider for common count-type fields
  const isCount = field.key.toLowerCase().includes('count')
  const max = isCount ? Math.max(50, value * 3) : 100
  const min = 0
  const step = isCount ? 1 : 1

  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={field.key} className="text-sm font-normal">
        {field.label}
      </Label>
      {isCount ? (
        <Slider
          value={value}
          onValueChange={onChange}
          min={min}
          max={max}
          step={step}
        />
      ) : (
        <Input
          id={field.key}
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-32"
        />
      )}
    </div>
  )
}

function StringField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={field.key} className="text-sm font-normal">
        {field.label}
      </Label>
      <Input
        id={field.key}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function EnumField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: string
  onChange: (v: string) => void
}) {
  const options = field.enumOptions ?? []
  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={field.key} className="text-sm font-normal">
        {field.label}
      </Label>
      <select
        id={field.key}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{humanizeKey(opt)}</option>
        ))}
      </select>
    </div>
  )
}

function ArrayField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: string[]
  onChange: (v: string[]) => void
}) {
  // If default array contains string items, render as multi-select checkboxes
  const defaults = (field.defaultValue as string[]) ?? []
  // Try to offer all default items plus any extras in current value
  const allOptions = Array.from(new Set([...defaults, ...value]))

  const toggle = (item: string) => {
    onChange(
      value.includes(item) ? value.filter(v => v !== item) : [...value, item],
    )
  }

  return (
    <div className="space-y-2 py-3">
      <Label className="text-sm font-normal">{field.label}</Label>
      <div className="flex flex-wrap gap-2">
        {allOptions.map(item => {
          const isChecked = value.includes(item)
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all
                ${isChecked
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/60'
                }
              `}
            >
              <span
                className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded border transition-colors ${
                  isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                }`}
                aria-hidden
              >
                {isChecked && <Check size={8} strokeWidth={3} />}
              </span>
              {humanizeKey(item)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepGeneric({
  blueprintId,
  componentDef,
  instanceCount,
  initialConfig,
  onSave,
}: WizardStepGenericProps) {
  const defaults = (componentDef.configSchema.defaults ?? {}) as Record<string, unknown>
  const fields = useMemo(() => extractFields(defaults), [defaults])

  const [config, setConfig] = useState<Record<string, unknown>>({
    ...defaults,
    ...initialConfig,
  })
  const [applyToAll, setApplyToAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateField = useCallback((key: string, value: unknown) => {
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

  const Icon = COMPONENT_ICONS[componentDef.id] ?? COMPONENT_ICON_FALLBACK

  // Split fields into booleans (for a toggle section) and others
  const booleanFields = fields.filter(f => f.type === 'boolean')
  const otherFields = fields.filter(f => f.type !== 'boolean' && f.type !== 'unknown')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Icon size={18} />
          {componentDef.name} Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for {instanceCount} {componentDef.name.toLowerCase()}{instanceCount !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Non-boolean fields */}
      {otherFields.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            {otherFields.map(field => {
              const value = config[field.key] ?? field.defaultValue
              switch (field.type) {
                case 'number':
                  return (
                    <NumberField
                      key={field.key}
                      field={field}
                      value={value as number}
                      onChange={v => updateField(field.key, v)}
                    />
                  )
                case 'string':
                  return (
                    <StringField
                      key={field.key}
                      field={field}
                      value={value as string}
                      onChange={v => updateField(field.key, v)}
                    />
                  )
                case 'enum':
                  return (
                    <EnumField
                      key={field.key}
                      field={field}
                      value={value as string}
                      onChange={v => updateField(field.key, v)}
                    />
                  )
                case 'array':
                  return (
                    <ArrayField
                      key={field.key}
                      field={field}
                      value={value as string[]}
                      onChange={v => updateField(field.key, v)}
                    />
                  )
                default:
                  return null
              }
            })}
          </CardContent>
        </Card>
      )}

      {/* Boolean toggles */}
      {booleanFields.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Options</CardTitle>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            {booleanFields.map(field => (
              <BooleanField
                key={field.key}
                field={field}
                value={config[field.key] as boolean}
                onChange={v => updateField(field.key, v)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Apply to all */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="apply-all-gen" className="flex items-center gap-2 text-sm font-normal">
              <Copy size={14} className="text-muted-foreground" />
              Apply to all {instanceCount} {componentDef.name.toLowerCase()}{instanceCount !== 1 ? 's' : ''}
            </Label>
            <Switch
              id="apply-all-gen"
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
          {saving ? 'Saving...' : `Save ${componentDef.name} Settings`}
        </Button>
      </div>
    </div>
  )
}
