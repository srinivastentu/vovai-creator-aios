"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  clampPct,
  pctFromPointer,
  SPLIT_DEFAULT_PCT,
  SPLIT_MAX_PCT,
  SPLIT_MIN_PCT,
} from "./split"

// Draggable two-column split. The divider is clamped to [28, 72]% (CR-13 §1).
// Width lives in component state (per-route, per-session) — not persisted.
export function SplitPane({
  left,
  right,
  defaultLeftPct = SPLIT_DEFAULT_PCT,
  className,
}: {
  left: ReactNode
  right: ReactNode
  defaultLeftPct?: number
  className?: string
}) {
  const [leftPct, setLeftPct] = useState(() => clampPct(defaultLeftPct))
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setLeftPct(pctFromPointer(clientX, rect.left, rect.width))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragging, updateFromClientX])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setLeftPct((p) => clampPct(p - 2))
    else if (e.key === "ArrowRight") setLeftPct((p) => clampPct(p + 2))
    else return
    e.preventDefault()
  }

  return (
    <div ref={containerRef} className={cn("flex h-full w-full overflow-hidden", className)}>
      <div className="min-w-0 overflow-auto" style={{ width: `${leftPct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={SPLIT_MIN_PCT}
        aria-valuemax={SPLIT_MAX_PCT}
        aria-label="Resize panels"
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative w-px shrink-0 cursor-col-resize bg-border outline-none",
          "before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']",
          "hover:bg-blue-600 focus-visible:bg-blue-600",
          dragging && "bg-blue-600",
        )}
        data-dragging={dragging ? "" : undefined}
      />
      <div className="min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  )
}
