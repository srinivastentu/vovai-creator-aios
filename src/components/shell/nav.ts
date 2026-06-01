import { Grid3X3, Layers, Users, Lightbulb, Waypoints, ShieldCheck } from "lucide-react"
import type { NavItem } from "./types"

// Pure NavRail helpers — no React state, no rendering. Kept separate from
// NavRail.tsx so the active-section logic and item list are unit-testable.

const V11_HINT = "Coming in V1.1"

/**
 * The far-left rail items. Global items (Dashboard, Workspaces, Personas) are
 * always enabled. Ideas is workspace-scoped: enabled only when a workspace is
 * active. Pipeline + Audit are deferred to V1.1 (their routes don't exist yet),
 * so they render disabled with a hint.
 */
export function buildNavItems(workspaceId?: string): NavItem[] {
  return [
    { key: "dashboard", href: "/", label: "Dashboard", icon: Grid3X3 },
    { key: "workspaces", href: "/workspaces", label: "Workspaces", icon: Layers },
    { key: "personas", href: "/personas", label: "Personas", icon: Users },
    workspaceId
      ? { key: "ideas", href: `/workspaces/${workspaceId}/ideas`, label: "Ideas", icon: Lightbulb }
      : {
          key: "ideas",
          href: "/workspaces",
          label: "Ideas",
          icon: Lightbulb,
          disabled: true,
          disabledHint: "Open a workspace to view its ideas",
        },
    {
      key: "pipeline",
      href: "/workspaces",
      label: "Pipeline",
      icon: Waypoints,
      disabled: true,
      disabledHint: V11_HINT,
    },
    {
      key: "audit",
      href: "/workspaces",
      label: "Audit",
      icon: ShieldCheck,
      disabled: true,
      disabledHint: V11_HINT,
    },
  ]
}

/**
 * The active rail section for a pathname. One section is active at a time —
 * workspace-scoped sub-routes (ideas/pipeline/audit) win over the generic
 * "workspaces" section; the workspace dashboard + review screens map back to
 * "workspaces".
 */
export function activeNavKey(pathname: string): string | null {
  if (pathname === "/") return "dashboard"
  if (pathname === "/personas" || pathname.startsWith("/personas/")) return "personas"
  if (pathname === "/workspaces" || pathname === "/workspaces/new") return "workspaces"
  if (pathname.startsWith("/workspaces/")) {
    // /workspaces/{id}/<rest...>
    const rest = pathname.split("/").slice(3).join("/")
    if (rest.startsWith("ideas")) return "ideas"
    if (rest.startsWith("pipelines")) return "pipeline"
    if (rest.startsWith("audit")) return "audit"
    return "workspaces"
  }
  return null
}

/** Whether a given nav item is the active section for the current pathname. */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return activeNavKey(pathname) === item.key
}
