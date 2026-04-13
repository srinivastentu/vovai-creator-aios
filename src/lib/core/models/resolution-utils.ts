// Utilities for selecting the closest supported resolution for a given target.
// Pure functions, no I/O, safe to import from server and client.

export interface Resolution {
  width: number
  height: number
}

export function parseResolution(s: string): Resolution | null {
  const m = /^(\d+)x(\d+)$/i.exec(s.trim())
  if (!m) return null
  return { width: Number(m[1]), height: Number(m[2]) }
}

// Pick the supported resolution closest to target. Prefer aspect-ratio match,
// then nearest total pixel count. Returns null if no resolutions are given.
export function pickClosestResolution(
  supported: string[] | undefined,
  target: Resolution,
): Resolution | null {
  if (!supported || supported.length === 0) return null
  const parsed = supported
    .map(parseResolution)
    .filter((r): r is Resolution => r !== null)
  if (parsed.length === 0) return null

  const targetRatio = target.width / target.height
  const targetPixels = target.width * target.height

  let best = parsed[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const r of parsed) {
    const ratio = r.width / r.height
    const ratioDelta = Math.abs(ratio - targetRatio) / targetRatio
    const pixelDelta = Math.abs(r.width * r.height - targetPixels) / targetPixels
    // Aspect ratio dominates; pixel count tie-breaks.
    const score = ratioDelta * 10 + pixelDelta
    if (score < bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}

export function resolutionsEqual(a: Resolution, b: Resolution): boolean {
  return a.width === b.width && a.height === b.height
}
