// Pure SplitPane geometry — kept out of the client component so the clamp is
// unit-testable. The divider is clamped to [28, 72]% per CR-13 §1.

export const SPLIT_MIN_PCT = 28
export const SPLIT_MAX_PCT = 72
export const SPLIT_DEFAULT_PCT = 55

/** Clamp a left-column percentage into the allowed [min, max] band. */
export function clampPct(
  pct: number,
  min: number = SPLIT_MIN_PCT,
  max: number = SPLIT_MAX_PCT,
): number {
  if (Number.isNaN(pct)) return min
  return Math.min(max, Math.max(min, pct))
}

/** Left-column percentage from a pointer x within a container of known width. */
export function pctFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return SPLIT_DEFAULT_PCT
  return clampPct(((clientX - left) / width) * 100)
}
