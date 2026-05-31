'use client'

function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className}`} />
  )
}

/** Skeleton for the tree view panel */
export function TreeSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Bone className="h-4 w-4 rounded-full" />
        <Bone className="h-4 w-32" />
      </div>
      {/* Tree rows */}
      <div className="flex-1 space-y-1.5 px-4 py-3">
        {/* Module 1 */}
        <div className="flex items-center gap-2 py-1.5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-48" />
          <div className="ml-auto flex gap-1">
            <Bone className="h-2 w-2 rounded-full" />
            <Bone className="h-2 w-2 rounded-full" />
          </div>
          <Bone className="h-4 w-14 rounded" />
        </div>
        {/* Topic 1.1 */}
        <div className="flex items-center gap-2 py-1.5 pl-5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-40" />
          <div className="ml-auto flex gap-1">
            <Bone className="h-2 w-2 rounded-full" />
          </div>
          <Bone className="h-4 w-14 rounded" />
        </div>
        {/* Topic 1.2 */}
        <div className="flex items-center gap-2 py-1.5 pl-5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-36" />
          <Bone className="h-4 w-14 rounded" />
        </div>
        {/* Module 2 */}
        <div className="flex items-center gap-2 py-1.5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-44" />
          <div className="ml-auto flex gap-1">
            <Bone className="h-2 w-2 rounded-full" />
            <Bone className="h-2 w-2 rounded-full" />
            <Bone className="h-2 w-2 rounded-full" />
          </div>
          <Bone className="h-4 w-14 rounded" />
        </div>
        {/* Topic 2.1 */}
        <div className="flex items-center gap-2 py-1.5 pl-5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-32" />
          <Bone className="h-4 w-14 rounded" />
        </div>
        {/* Module 3 */}
        <div className="flex items-center gap-2 py-1.5">
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-4" />
          <Bone className="h-4 w-40" />
          <Bone className="h-4 w-14 rounded" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton for the node detail panel */
export function NodeDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Bone className="h-5 w-14 rounded" />
          <Bone className="h-5 w-16 rounded" />
        </div>
        <Bone className="h-5 w-48" />
      </div>
      {/* Description */}
      <div className="border-b px-4 py-3">
        <Bone className="mb-2 h-3 w-20" />
        <Bone className="h-16 w-full" />
      </div>
      {/* Outcomes */}
      <div className="border-b px-4 py-3">
        <Bone className="mb-2 h-3 w-32" />
        <div className="space-y-2">
          <Bone className="h-12 w-full rounded-md" />
          <Bone className="h-12 w-full rounded-md" />
        </div>
      </div>
      {/* Components */}
      <div className="border-b px-4 py-3">
        <Bone className="mb-2 h-3 w-24" />
        <div className="space-y-1">
          <Bone className="h-8 w-full rounded-md" />
          <Bone className="h-8 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton for a wizard step content area */
export function WizardStepSkeleton() {
  return (
    <div className="space-y-4">
      <Bone className="h-6 w-48" />
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-3/4" />
      <div className="mt-6 space-y-3">
        <Bone className="h-10 w-full rounded-md" />
        <Bone className="h-10 w-full rounded-md" />
        <Bone className="h-10 w-full rounded-md" />
      </div>
    </div>
  )
}
