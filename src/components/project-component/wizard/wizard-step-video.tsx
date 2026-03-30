'use client'

import { useState, useCallback } from 'react'
import {
  Video,
  Palette,
  Languages,
  Music,
  Captions,
  User,
  Copy,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { COMPONENT_REGISTRY } from '@/lib/project-component'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoConfig {
  duration: number
  style: 'animated_2d' | 'whiteboard' | 'motion_graphics'
  language: string
  voiceGender: 'male' | 'female'
  subtitles: boolean
  backgroundMusic: boolean
}

export interface WizardStepVideoProps {
  blueprintId: string
  instanceCount: number
  moduleCount: number
  initialConfig?: Partial<VideoConfig>
  onSave: (config: VideoConfig, applyToAll: boolean) => Promise<void>
}

const DEFAULT_CONFIG: VideoConfig = {
  duration: 480,
  style: 'animated_2d',
  language: 'en',
  voiceGender: 'male',
  subtitles: true,
  backgroundMusic: true,
}

const STYLE_OPTIONS: { value: VideoConfig['style']; label: string; description: string }[] = [
  { value: 'animated_2d', label: 'Animated 2D', description: 'Colorful illustrations with smooth animations' },
  { value: 'whiteboard', label: 'Whiteboard', description: 'Hand-drawn style on white background' },
  { value: 'motion_graphics', label: 'Motion Graphics', description: 'Professional kinetic typography & shapes' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'hi', label: 'Hindi' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ko', label: 'Korean' },
]

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepVideo({
  blueprintId,
  instanceCount,
  moduleCount,
  initialConfig,
  onSave,
}: WizardStepVideoProps) {
  const registryDef = COMPONENT_REGISTRY.video
  const [config, setConfig] = useState<VideoConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })
  const [applyToAll, setApplyToAll] = useState(true)
  const [customizePerModule, setCustomizePerModule] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateConfig = useCallback(<K extends keyof VideoConfig>(
    key: K,
    value: VideoConfig[K],
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
          <Video size={18} />
          Video Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for {instanceCount} video{instanceCount !== 1 ? 's' : ''} in this project.
        </p>
      </div>

      {/* Duration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Duration</CardTitle>
          <CardDescription className="text-xs">
            Target video length ({formatDuration(60)} – {formatDuration(600)})
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Slider
            value={config.duration}
            onValueChange={v => updateConfig('duration', v)}
            min={60}
            max={600}
            step={30}
            suffix=""
            showValue={false}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>1 min</span>
            <span className="text-sm font-medium text-foreground">{formatDuration(config.duration)}</span>
            <span>10 min</span>
          </div>
        </CardContent>
      </Card>

      {/* Style selector — visual cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Palette size={14} />
            Visual Style
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-3">
            {STYLE_OPTIONS.map(opt => {
              const isSelected = config.style === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('style', opt.value)}
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

      {/* Language + Voice Gender */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Languages size={14} />
              Language
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <select
              value={config.language}
              onChange={e => updateConfig('language', e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Voice Gender — toggle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <User size={14} />
              Voice Gender
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex rounded-lg border border-input p-0.5">
              {(['male', 'female'] as const).map(gender => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => updateConfig('voiceGender', gender)}
                  className={`
                    flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors
                    ${config.voiceGender === gender
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  {gender}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toggles: Subtitles, Background Music */}
      <Card>
        <CardContent className="divide-y py-0">
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="subtitles" className="flex items-center gap-2 text-sm font-normal">
              <Captions size={14} className="text-muted-foreground" />
              Subtitles / Captions
            </Label>
            <Switch
              id="subtitles"
              checked={config.subtitles}
              onCheckedChange={v => updateConfig('subtitles', v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="music" className="flex items-center gap-2 text-sm font-normal">
              <Music size={14} className="text-muted-foreground" />
              Background Music
            </Label>
            <Switch
              id="music"
              checked={config.backgroundMusic}
              onCheckedChange={v => updateConfig('backgroundMusic', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Apply to all + Customize per module */}
      <Card>
        <CardContent className="divide-y py-0">
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="apply-all" className="flex items-center gap-2 text-sm font-normal">
              <Copy size={14} className="text-muted-foreground" />
              Apply to all {instanceCount} videos
            </Label>
            <Switch
              id="apply-all"
              checked={applyToAll}
              onCheckedChange={setApplyToAll}
            />
          </div>
          {moduleCount > 1 && (
            <div className="py-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="per-module" className="text-sm font-normal">
                  Customize per module
                </Label>
                <Switch
                  id="per-module"
                  checked={customizePerModule}
                  onCheckedChange={setCustomizePerModule}
                />
              </div>
              {customizePerModule && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Per-module overrides will be available after saving global defaults.
                  Save these settings first, then revisit this step to customize individual modules.
                </p>
              )}
            </div>
          )}
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
          {saving ? 'Saving...' : 'Save Video Settings'}
        </Button>
      </div>
    </div>
  )
}
