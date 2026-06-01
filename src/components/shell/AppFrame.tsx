import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { NavRail } from "./NavRail"
import { TopBar } from "./TopBar"
import { GovernanceRibbon } from "./GovernanceRibbon"
import { SplitPane } from "./SplitPane"
import { PreviewPane } from "./PreviewPane"
import type { Breadcrumb, FrameVariant, GovernanceRibbonData } from "./types"

// The CR-13 Workbench frame. A server component that composes the client
// NavRail + SplitPane and threads server-rendered `left`/`preview` content
// through as props. `variant="review"` auto-collapses the rail and shows the
// governance ribbon (row 2).
export function AppFrame({
  variant = "standard",
  workspaceId,
  breadcrumbs,
  workspaceSwitcher,
  statusPill,
  ribbon,
  left,
  preview,
  previewTitle,
  previewEmpty,
  defaultLeftPct,
}: {
  variant?: FrameVariant
  workspaceId?: string
  breadcrumbs: Breadcrumb[]
  workspaceSwitcher?: ReactNode
  statusPill?: ReactNode
  ribbon?: GovernanceRibbonData
  left: ReactNode
  preview?: ReactNode
  previewTitle?: string
  previewEmpty?: { icon?: LucideIcon; title: string; description?: string }
  defaultLeftPct?: number
}) {
  const isReview = variant === "review"
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <NavRail workspaceId={workspaceId} defaultCollapsed={isReview} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumbs={breadcrumbs}
          workspaceSwitcher={workspaceSwitcher}
          statusPill={statusPill}
        />
        {isReview && ribbon ? <GovernanceRibbon data={ribbon} /> : null}
        <div className="min-h-0 flex-1">
          <SplitPane
            defaultLeftPct={defaultLeftPct}
            left={<div className="h-full overflow-auto">{left}</div>}
            right={
              <PreviewPane title={previewTitle} empty={previewEmpty}>
                {preview}
              </PreviewPane>
            }
          />
        </div>
      </div>
    </div>
  )
}
