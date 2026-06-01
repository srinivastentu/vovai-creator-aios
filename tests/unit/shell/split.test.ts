import { describe, it, expect } from "vitest"
import {
  clampPct,
  pctFromPointer,
  SPLIT_MIN_PCT,
  SPLIT_MAX_PCT,
  SPLIT_DEFAULT_PCT,
} from "@/components/shell/split"

describe("SplitPane geometry", () => {
  it("clamps below the minimum up to 28%", () => {
    expect(clampPct(10)).toBe(SPLIT_MIN_PCT)
    expect(clampPct(-5)).toBe(28)
  })

  it("clamps above the maximum down to 72%", () => {
    expect(clampPct(90)).toBe(SPLIT_MAX_PCT)
    expect(clampPct(72.1)).toBe(72)
  })

  it("leaves an in-band value unchanged", () => {
    expect(clampPct(55)).toBe(55)
    expect(clampPct(28)).toBe(28)
    expect(clampPct(72)).toBe(72)
  })

  it("falls back to the minimum for NaN", () => {
    expect(clampPct(Number.NaN)).toBe(SPLIT_MIN_PCT)
  })

  it("derives a clamped percentage from a pointer position", () => {
    // container left=0 width=1000; pointer at 550 → 55%
    expect(pctFromPointer(550, 0, 1000)).toBeCloseTo(55)
    // pointer far left → clamped to 28
    expect(pctFromPointer(50, 0, 1000)).toBe(28)
    // pointer far right → clamped to 72
    expect(pctFromPointer(990, 0, 1000)).toBe(72)
    // zero width → default
    expect(pctFromPointer(100, 0, 0)).toBe(SPLIT_DEFAULT_PCT)
  })
})
