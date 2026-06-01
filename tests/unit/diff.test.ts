import { describe, it, expect } from "vitest"
import { diffLines, diffStats } from "../../src/lib/diff"

describe("diffLines", () => {
  it("returns all-equal ops for identical text", () => {
    const ops = diffLines("a\nb\nc", "a\nb\nc")
    expect(ops.every((o) => o.type === "equal")).toBe(true)
    expect(ops).toHaveLength(3)
    expect(ops[0]).toEqual({ type: "equal", value: "a", aLine: 1, bLine: 1 })
  })

  it("detects a changed middle line as remove + add", () => {
    const ops = diffLines("a\nb\nc", "a\nB\nc")
    expect(ops.map((o) => o.type)).toEqual(["equal", "remove", "add", "equal"])
    const removed = ops.find((o) => o.type === "remove")
    const added = ops.find((o) => o.type === "add")
    expect(removed).toMatchObject({ value: "b", aLine: 2, bLine: null })
    expect(added).toMatchObject({ value: "B", aLine: null, bLine: 2 })
  })

  it("handles a pure insertion at the end", () => {
    const ops = diffLines("a\nb", "a\nb\nc")
    expect(ops.map((o) => o.type)).toEqual(["equal", "equal", "add"])
    expect(ops[2]).toMatchObject({ value: "c", aLine: null, bLine: 3 })
  })

  it("handles a pure deletion", () => {
    const ops = diffLines("a\nb\nc", "a\nc")
    expect(ops.map((o) => o.type)).toEqual(["equal", "remove", "equal"])
  })

  it("preserves the LCS across a reorder-ish edit", () => {
    const a = "intro\nbody one\nbody two\nconclusion"
    const b = "intro\nbody two\nconclusion"
    const ops = diffLines(a, b)
    // "body one" is removed; intro/body two/conclusion stay common.
    expect(ops.filter((o) => o.type === "remove").map((o) => o.value)).toEqual(["body one"])
    expect(ops.filter((o) => o.type === "equal").map((o) => o.value)).toEqual([
      "intro",
      "body two",
      "conclusion",
    ])
  })
})

describe("diffStats", () => {
  it("counts adds, removes, and unchanged", () => {
    const ops = diffLines("a\nb\nc", "a\nB\nc\nd")
    const stats = diffStats(ops)
    expect(stats.removed).toBe(1) // b
    expect(stats.added).toBe(2) // B, d
    expect(stats.unchanged).toBe(2) // a, c
  })
})
