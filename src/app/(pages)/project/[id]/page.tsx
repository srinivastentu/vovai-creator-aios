'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectPage } from '@/lib/hooks/use-project-page'
import { ErrorBanner } from '@/components/project-component/shared/error-banner'
import { ProjectTopBar } from '@/components/project-component/layout/project-top-bar'
import { ProjectPageLayout } from '@/components/project-component/layout/project-page-layout'
import { ChatColumn } from '@/components/project-component/layout/chat-column'
import { ArtifactPanel } from '@/components/project-component/layout/artifact-panel'

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const state = useProjectPage(projectId)

  // ── Loading / Error States ────────────────────────────────────────────────

  if (state.blueprintLoading || (state.isNotFound && !state.autoCreateError)) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
        <span className="text-sm text-muted-foreground">
          {state.isNotFound ? 'Setting up project...' : 'Loading project...'}
        </span>
      </main>
    )
  }

  if (state.autoCreateError || (!state.blueprint && !state.blueprintLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <ErrorBanner
          message={state.autoCreateError ?? 'Failed to load project'}
          onRetry={state.retryBlueprint}
          variant="card"
        />
      </main>
    )
  }

  // ── Main Layout ───────────────────────────────────────────────────────────

  return (
    <ProjectPageLayout
      panelOpen={state.panelOpen}
      topBar={
        <ProjectTopBar
          projectName={state.blueprint?.project.name ?? 'Untitled Project'}
          currentPhase={state.currentPhase}
          sessionCost={state.totalCost}
          panelOpen={state.panelOpen}
          onTogglePanel={() => state.setPanelOpen(p => !p)}
          onBack={() => router.push('/')}
          onRename={state.renameProject}
        />
      }
      chatColumn={
        <ChatColumn
          currentPhase={state.currentPhase}
          score={state.score}
          loopCount={state.loopCount}
          completedPhases={state.completedPhases}
          entries={state.activityEntries}
          messagesLoading={state.messagesLoading}
          messagesError={state.messagesError}
          autoStarting={state.autoStarting}
          startLoading={state.ideation.startLoading}
          hasConversation={state.hasConversation}
          onRetryMessages={() => state.retryMessages()}
          anyLoading={state.ideation.anyLoading}
          gradeLoading={state.ideation.gradeLoading}
          reviewLoading={state.ideation.reviewLoading}
          sendLoading={state.ideation.sendLoading}
          gradeError={state.ideation.gradeError}
          reviewError={state.ideation.reviewError}
          sendError={state.ideation.sendError}
          showProceed={state.showProceed}
          awaitingAudienceConfirmation={state.awaitingAudienceConfirmation}
          onConfirmAudience={state.ideation.confirmAudience}
          confirmAudienceLoading={state.ideation.confirmAudienceLoading}
          onProceed={() => state.ideation.sendMessage('proceed')}
          onGrade={state.ideation.gradeStructure}
          onApprove={async () => {
            try {
              await state.ideation.submitReview('approve')
            } catch {
              // Error captured in reviewError
            }
          }}
          onSendFeedback={(msg) => state.ideation.submitReview('feedback', msg)}
          onRestructure={() => {
            if (window.confirm('Start over from brainstorm? Brief and audience will be retained.')) {
              state.ideation.submitReview('restructure')
            }
          }}
          onSendMessage={state.handleSendMessage}
          onNavigateToTab={(tab) => {
            state.setActiveTab(tab)
            state.setPanelOpen(true)
          }}
        />
      }
      artifactPanel={
        <ArtifactPanel
          activeTab={state.activeTab}
          onTabChange={state.setActiveTab}
          visibleTabs={state.visibleTabs}
          blueprintId={state.blueprint?.id ?? null}
          projectId={projectId}
          proposedStructure={state.proposedStructure}
          audienceProfile={state.audienceProfile}
          structureRefreshKey={state.structureRefreshKey}
          isMaterialized={state.isMaterialized}
          onMaterialize={state.materializeStructure}
          materializeLoading={state.materializeLoading}
          materializeError={state.materializeError}
          archetype={state.blueprint?.archetype ?? null}
          projectName={state.blueprint?.project.name ?? 'Untitled Project'}
        />
      }
    />
  )
}
