'use client'

import type { ReactNode } from 'react'

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectPageLayoutProps {
  topBar: ReactNode
  chatColumn: ReactNode
  artifactPanel: ReactNode
  panelOpen: boolean
}

export function ProjectPageLayout({
  topBar,
  chatColumn,
  artifactPanel,
  panelOpen,
}: ProjectPageLayoutProps) {
  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      {topBar}

      {/* Content: chat + artifact panel */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Chat column */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            panelOpen ? 'w-[55%]' : 'w-full'
          }`}
        >
          {chatColumn}
        </div>

        {/* Artifact panel */}
        <div
          className={`border-l transition-all duration-300 ${
            panelOpen ? 'w-[45%]' : 'w-0 border-l-0'
          }`}
        >
          {panelOpen && artifactPanel}
        </div>
      </div>
    </main>
  )
}
