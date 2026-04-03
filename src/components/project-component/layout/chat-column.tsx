'use client'

import { Loader2 } from 'lucide-react'
import { ActivityStream } from '@/components/project-component/chat/activity-stream'
import { PhaseActions } from '@/components/project-component/chat/phase-actions'
import { PhaseIndicator } from '@/components/project-component/chat/phase-indicator'
import { ErrorBanner } from '@/components/project-component/shared/error-banner'
import type { ActivityEntry } from '@/components/project-component/chat/activity-card'
import type { IdeationPhase } from '@/lib/project-component'
import type { ArtifactTab } from '@/components/project-component/layout/artifact-panel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatColumnProps {
  // Phase indicator
  currentPhase: IdeationPhase
  score: number | null
  loopCount: number
  completedPhases: IdeationPhase[]
  // Activity stream
  entries: ActivityEntry[]
  // Loading / error
  messagesLoading: boolean
  messagesError: string | null
  autoStarting: boolean
  startLoading: boolean
  hasConversation: boolean
  onRetryMessages: () => void
  onNavigateToTab?: (tab: ArtifactTab) => void
  // Phase actions (all forwarded)
  anyLoading: boolean
  gradeLoading: boolean
  reviewLoading: boolean
  sendLoading: boolean
  gradeError: string | null
  reviewError: string | null
  sendError: string | null
  showProceed: boolean
  awaitingAudienceConfirmation: boolean
  onProceed: () => void
  onGrade: () => void
  onApprove: () => void
  onSendFeedback: (msg: string) => void
  onRestructure: () => void
  onSendMessage: (msg: string) => void
  onConfirmAudience: (action: 'confirm' | 'revise', message?: string) => void
  confirmAudienceLoading: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatColumn({
  currentPhase,
  score,
  loopCount,
  completedPhases,
  entries,
  messagesLoading,
  messagesError,
  autoStarting,
  startLoading,
  hasConversation,
  onRetryMessages,
  onNavigateToTab,
  anyLoading,
  gradeLoading,
  reviewLoading,
  sendLoading,
  gradeError,
  reviewError,
  sendError,
  showProceed,
  awaitingAudienceConfirmation,
  onProceed,
  onGrade,
  onApprove,
  onSendFeedback,
  onRestructure,
  onSendMessage,
  onConfirmAudience,
  confirmAudienceLoading,
}: ChatColumnProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Phase indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        score={score}
        loopCount={loopCount}
        completedPhases={completedPhases}
      />

      {/* Message area */}
      {messagesLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
          <span className="text-xs text-muted-foreground">Loading conversation...</span>
        </div>
      ) : messagesError ? (
        <div className="p-4">
          <ErrorBanner
            message={messagesError}
            onRetry={onRetryMessages}
            variant="card"
          />
        </div>
      ) : !hasConversation && (autoStarting || startLoading) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
          <p className="text-sm text-muted-foreground">
            AI agents are analyzing your brief and designing the course structure...
          </p>
        </div>
      ) : (
        <ActivityStream entries={entries} onNavigateToTab={onNavigateToTab} />
      )}

      {/* Phase actions + chat input (sticky bottom) */}
      {hasConversation && (
        <PhaseActions
          currentPhase={currentPhase}
          anyLoading={anyLoading}
          gradeLoading={gradeLoading}
          reviewLoading={reviewLoading}
          sendLoading={sendLoading}
          gradeError={gradeError}
          reviewError={reviewError}
          sendError={sendError}
          score={score}
          showProceed={showProceed}
          awaitingAudienceConfirmation={awaitingAudienceConfirmation}
          onProceed={onProceed}
          onGrade={onGrade}
          onApprove={onApprove}
          onSendFeedback={onSendFeedback}
          onRestructure={onRestructure}
          onSendMessage={onSendMessage}
          onConfirmAudience={onConfirmAudience}
          confirmAudienceLoading={confirmAudienceLoading}
        />
      )}
    </div>
  )
}
