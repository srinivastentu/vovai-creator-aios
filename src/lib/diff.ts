// Pure, dependency-free line diff (LCS). Powers the Gate B "diff between any two
// versions" view. Generic display utility — no domain words, no deps — so it lives
// beside format.ts / utils.ts rather than in core/ or domain/.

export type DiffOpType = "equal" | "add" | "remove"

export interface DiffLine {
  type: DiffOpType
  value: string
  /** 1-based line number in the OLD (a) text; null for added lines. */
  aLine: number | null
  /** 1-based line number in the NEW (b) text; null for removed lines. */
  bLine: number | null
}

/** Bottom-up LCS length table for two line arrays. dp[i][j] = LCS(a[i:], b[j:]). */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  return dp
}

/**
 * Diff two texts by line. Returns an ordered op list: `equal` lines are common,
 * `remove` lines are in `aText` only, `add` lines are in `bText` only. Ties favor
 * `remove` (deletions surface before insertions at the same position).
 */
export function diffLines(aText: string, bText: string): DiffLine[] {
  const a = aText.split("\n")
  const b = bText.split("\n")
  const dp = lcsTable(a, b)
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "equal", value: a[i], aLine: i + 1, bLine: j + 1 })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", value: a[i], aLine: i + 1, bLine: null })
      i++
    } else {
      out.push({ type: "add", value: b[j], aLine: null, bLine: j + 1 })
      j++
    }
  }
  while (i < a.length) {
    out.push({ type: "remove", value: a[i], aLine: i + 1, bLine: null })
    i++
  }
  while (j < b.length) {
    out.push({ type: "add", value: b[j], aLine: null, bLine: j + 1 })
    j++
  }
  return out
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export function diffStats(ops: DiffLine[]): DiffStats {
  return ops.reduce<DiffStats>(
    (s, op) => {
      if (op.type === "add") s.added++
      else if (op.type === "remove") s.removed++
      else s.unchanged++
      return s
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}
