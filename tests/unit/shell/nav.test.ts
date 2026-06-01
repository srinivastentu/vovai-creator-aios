import { describe, it, expect } from "vitest"
import { buildNavItems, activeNavKey, isNavItemActive } from "@/components/shell/nav"

describe("NavRail items", () => {
  it("always exposes the six sections", () => {
    const keys = buildNavItems().map((i) => i.key)
    expect(keys).toEqual(["dashboard", "workspaces", "personas", "ideas", "pipeline", "audit"])
  })

  it("disables Ideas without a workspace and enables it with one", () => {
    const noWs = buildNavItems().find((i) => i.key === "ideas")!
    expect(noWs.disabled).toBe(true)

    const withWs = buildNavItems("ws-1").find((i) => i.key === "ideas")!
    expect(withWs.disabled).toBeUndefined()
    expect(withWs.href).toBe("/workspaces/ws-1/ideas")
  })

  it("keeps Pipeline + Audit disabled (deferred to V1.1) regardless of workspace", () => {
    for (const item of buildNavItems("ws-1")) {
      if (item.key === "pipeline" || item.key === "audit") {
        expect(item.disabled).toBe(true)
        expect(item.disabledHint).toBe("Coming in V1.1")
      }
    }
  })
})

describe("active nav section", () => {
  const cases: Array<[string, string | null]> = [
    ["/", "dashboard"],
    ["/personas", "personas"],
    ["/personas/abc", "personas"],
    ["/workspaces", "workspaces"],
    ["/workspaces/new", "workspaces"],
    ["/workspaces/ws1", "workspaces"],
    ["/workspaces/ws1/master/m1/review", "workspaces"],
    ["/workspaces/ws1/artifacts/a1/review", "workspaces"],
    ["/workspaces/ws1/ideas", "ideas"],
    ["/workspaces/ws1/pipelines/i1", "pipeline"],
    ["/workspaces/ws1/audit", "audit"],
    ["/unknown", null],
  ]

  for (const [path, expected] of cases) {
    it(`maps ${path} → ${expected}`, () => {
      expect(activeNavKey(path)).toBe(expected)
    })
  }

  it("isNavItemActive matches the active section", () => {
    const items = buildNavItems("ws1")
    const ideas = items.find((i) => i.key === "ideas")!
    expect(isNavItemActive("/workspaces/ws1/ideas", ideas)).toBe(true)
    const personas = items.find((i) => i.key === "personas")!
    expect(isNavItemActive("/workspaces/ws1/ideas", personas)).toBe(false)
  })
})
