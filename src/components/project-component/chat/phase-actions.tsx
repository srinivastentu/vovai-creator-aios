'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowRight, Check, Loader2, MessageSquare, Send, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextPanels } from './context-panels'
import type { BlueprintSummary } from './context-panels'
import type { IdeationPhase, ProposedStructure, AudienceProfile } from '@/lib/project-component'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhaseActionsProps {
  currentPhase: IdeationPhase
  anyLoading: boolean
  gradeLoading: boolean
  reviewLoading: boolean
  sendLoading: boolean
  gradeError: string | null
  reviewError: string | null
  sendError: string | null
  score: number | null
  showProceed: boolean
  onProceed: () => void
  onGrade: () => void
  onApprove: () => void
  onSendFeedback: (msg: string) => void
  onRestructure: () => void
  onSendMessage: (msg: string) => void
  // Context panel data
  proposedStructure: ProposedStructure | null
  audienceProfile: AudienceProfile | null
  blueprint: BlueprintSummary | null
  blueprintId: string | null
  projectId: string
  structureRefreshKey: number
  totalCost: number
}

// ─── Phase-specific button configs ───────────────────────────────────────────

function BrainstormActions({
  showProceed,
  loading,
  disabled,
  onProceed,
}: {
  showProceed: boolean
  loading: boolean
  disabled: boolean
  onProceed: () => void
}) {
  if (!showProceed) return null
  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={onProceed}
        disabled={disabled}
        className="bg-amber-600 text-white hover:bg-amber-700"
      >
        {loading ? (
          <Loader2 size={14} className="mr-2 animate-spin" />
        ) : (
          <ArrowRight size={14} className="mr-2" />
        )}
        Proceed to Structure Design
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Or keep chatting to refine your brief
      </p>
    </div>
  )
}

function StructureActions({
  loading,
  disabled,
  error,
  onGrade,
}: {
  loading: boolean
  disabled: boolean
  error: string | null
  onGrade: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={onGrade}
        disabled={disabled}
        className="bg-cyan-600 text-white hover:bg-cyan-700"
      >
        {loading ? (
          <Loader2 size={14} className="mr-2 animate-spin" />
        ) : (
          'Grade Structure'
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">
        Review the proposed structure above, then grade it
      </p>
    </div>
  )
}

function RefinementActions({
  loading,
  disabled,
  error,
  score,
  onGrade,
}: {
  loading: boolean
  disabled: boolean
  error: string | null
  score: number | null
  onGrade: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          onClick={onGrade}
          disabled={disabled}
          className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
        >
          {loading ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            'Grade Again'
          )}
        </Button>
        {score != null && (
          <Badge
            variant="outline"
            className={`text-xs ${
              score >= 75
                ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
            }`}
          >
            {score.toFixed(0)}/100
          </Badge>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {score != null && (
        <p className="text-center text-xs text-muted-foreground">
          {score >= 75
            ? 'Score meets threshold — grading will advance to review'
            : 'Score below 75 — agents will continue refining'
          }
        </p>
      )}
    </div>
  )
}

function ReviewActions({
  loading,
  disabled,
  error,
  onApprove,
  onFeedbackOpen,
  onRestructure,
}: {
  loading: boolean
  disabled: boolean
  error: string | null
  onApprove: () => void
  onFeedbackOpen: () => void
  onRestructure: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onApprove}
          disabled={disabled}
          className="flex-1 bg-green-600 text-white hover:bg-green-700"
        >
          {loading ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <>
              <Check size={14} className="mr-2" />
              Approve Structure
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onFeedbackOpen}
          disabled={disabled}
          className="flex-1"
        >
          <MessageSquare size={14} className="mr-2" />
          Give Feedback
        </Button>
        <Button
          variant="outline"
          onClick={onRestructure}
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          Start Over
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">
        Approve to proceed to configuration, or request changes
      </p>
    </div>
  )
}

function ApprovedBanner() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-3 dark:bg-green-950/30">
      <Check size={16} className="text-green-600" />
      <span className="text-sm font-medium text-green-700 dark:text-green-300">
        Blueprint approved — ready for configuration
      </span>
    </div>
  )
}

// ─── Inline Text Input ──────────────────────────────────────────────────────

function InlineInput({
  expanded,
  feedbackMode,
  loading,
  disabled,
  error,
  onSend,
  onCancel,
  onExpand,
}: {
  expanded: boolean
  feedbackMode: boolean
  loading: boolean
  disabled: boolean
  error: string | null
  onSend: (msg: string) => void
  onCancel: () => void
  onExpand: () => void
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [expanded])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || loading || disabled) return
    onSend(trimmed)
    setValue('')
  }, [value, loading, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  if (!expanded) {
    return (
      <button
        onClick={onExpand}
        className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare size={12} />
        <span>Or type a message...</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            feedbackMode
              ? 'Describe what should change... (Ctrl+Enter to send)'
              : 'Type your message... (Ctrl+Enter to send)'
          }
          disabled={loading || disabled}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!value.trim() || loading || disabled}
            className="h-8 w-8 p-0"
            aria-label="Send"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setValue(''); onCancel() }}
            className="h-8 w-8 p-0"
            aria-label="Cancel"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PhaseActions({
  currentPhase,
  anyLoading,
  gradeLoading,
  reviewLoading,
  sendLoading,
  gradeError,
  reviewError,
  sendError,
  score,
  showProceed,
  onProceed,
  onGrade,
  onApprove,
  onSendFeedback,
  onRestructure,
  onSendMessage,
  // Context panel data
  proposedStructure,
  audienceProfile,
  blueprint,
  blueprintId,
  projectId,
  structureRefreshKey,
  totalCost,
}: PhaseActionsProps) {
  const [inputExpanded, setInputExpanded] = useState(false)
  const [feedbackMode, setFeedbackMode] = useState(false)
  const [contextTab, setContextTab] = useState<'structure' | 'audience' | 'session' | null>(null)

  const handleFeedbackOpen = useCallback(() => {
    setFeedbackMode(true)
    setInputExpanded(true)
  }, [])

  const handleInputCancel = useCallback(() => {
    setInputExpanded(false)
    setFeedbackMode(false)
  }, [])

  const handleInputSend = useCallback((msg: string) => {
    if (feedbackMode && currentPhase === 'review') {
      onSendFeedback(msg)
    } else {
      onSendMessage(msg)
    }
    setInputExpanded(false)
    setFeedbackMode(false)
  }, [feedbackMode, currentPhase, onSendFeedback, onSendMessage])

  return (
    <div className="shrink-0 border-t bg-background">
      {/* Context panels */}
      <ContextPanels
        activeTab={contextTab}
        onTabChange={setContextTab}
        proposedStructure={proposedStructure}
        audienceProfile={audienceProfile}
        blueprint={blueprint}
        blueprintId={blueprintId}
        projectId={projectId}
        structureRefreshKey={structureRefreshKey}
        totalCost={totalCost}
      />

      {/* Action buttons + input */}
      <div className="px-4 py-3">
        {/* Phase-specific actions */}
        {currentPhase === 'brainstorm' && (
          <BrainstormActions
            showProceed={showProceed}
            loading={sendLoading}
            disabled={anyLoading}
            onProceed={onProceed}
          />
        )}
        {currentPhase === 'structure' && (
          <StructureActions
            loading={gradeLoading}
            disabled={anyLoading}
            error={gradeError}
            onGrade={onGrade}
          />
        )}
        {currentPhase === 'refinement' && (
          <RefinementActions
            loading={gradeLoading}
            disabled={anyLoading}
            error={gradeError}
            score={score}
            onGrade={onGrade}
          />
        )}
        {currentPhase === 'review' && (
          <ReviewActions
            loading={reviewLoading}
            disabled={anyLoading}
            error={reviewError}
            onApprove={onApprove}
            onFeedbackOpen={handleFeedbackOpen}
            onRestructure={onRestructure}
          />
        )}
        {currentPhase === 'approved' && <ApprovedBanner />}

        {/* Collapsed / expanded text input */}
        {currentPhase !== 'approved' && (
          <div className="mt-2">
            <InlineInput
              expanded={inputExpanded}
              feedbackMode={feedbackMode}
              loading={feedbackMode ? reviewLoading : sendLoading}
              disabled={anyLoading}
              error={feedbackMode ? reviewError : sendError}
              onSend={handleInputSend}
              onCancel={handleInputCancel}
              onExpand={() => setInputExpanded(true)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
