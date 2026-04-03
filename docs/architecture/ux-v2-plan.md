# UX v2: Conversational AI-First Redesign

> Convert the entire entry experience from form-based to conversational AI-first.
> The platform should feel like Claude/ChatGPT — a single prompt box, streaming
> responses, artifacts opening in a side panel.

**Branch:** `feature/ux-v2-conversational`
**Base:** `v1.0.0-project-component` on `main`
**Date:** 2026-04-03

---

## Problem Statement

The current UX requires 4 steps before any AI work begins:
1. Navigate to `/project/new`, fill a form
2. Navigate to `/project/[id]/ideation`
3. Click "Create Blueprint"
4. Click "Start Ideation"

Users must learn a multi-page navigation model (Ideation → Structure →
Configure → Launch) before they can accomplish anything.

## Target State

- User lands on a clean page with ONE prompt box
- Types their learning intent and hits Enter
- Everything happens on the SAME project page — no multi-page navigation
- AI agents stream responses below the prompt (like ChatGPT)
- Agents ask clarifying questions with CLICKABLE option chips
- When structure is ready, it opens in a RIGHT PANEL (like Claude artifacts)
- Conversation continues in the left column, artifacts in the right

---

## Architecture Decisions

### Decision 1: Routing Strategy — Option C (Hybrid)

- Landing page (`/`) is the entry point — prompt + recent projects only
- On Enter → create project → redirect to `/project/[id]`
- `/project/[id]` is the unified chat + artifact experience
- URL is bookmarkable/shareable per project
- Clicking a recent project goes to same `/project/[id]` route

### Decision 2: Layout — Approach A (Single Page, Client Tabs)

- One `page.tsx` at `/project/[id]` manages both chat and artifact panel
- Artifact panel tabs (Structure, Grade, Audience, Configure, Launch) are
  client-side state — no URL changes for tab switches
- Deep-linking available later via query params (`?tab=structure`) if needed
- Chat scroll position, input state, and streaming never disrupted by tab changes

---

## Design Specification

### 1. Landing Page (`/`)

**Layout:**
```
┌─────────────────────────────────────────────┐
│                                             │
│         VOVAI eLearn AIOS                   │
│    Your Agentic eLearning OS                │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Describe your learning intent here    │  │
│  │ to ideate, design, and build a great  │  │
│  │ learning experience...        [Send]  │  │
│  └───────────────────────────────────────┘  │
│  Enter to send · AI agents guide you        │
│                                             │
│  RECENT PROJECTS                            │
│  ┌─ AI in Agrientrepreneurship ─ In Prog ┐ │
│  ├─ Teacher Retooling in ID ── Approved ──┤ │
│  └─ CBSE Science Grade 8 ──── In Prog ───┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Dark background, vertically centered content
- Prompt box: auto-expanding textarea, rounded, subtle border
- Send button: blue arrow icon, right-aligned
- On Enter (or click Send):
  1. `POST /api/projects/quick-create` with `{ intent: "raw user text" }`
  2. API creates Project + Blueprint in one call
  3. Returns `{ projectId, blueprintId }`
  4. `router.push(`/project/${projectId}`)` — brief passed via sessionStorage
- Recent projects: fetched from `GET /api/projects`, sorted by updatedAt
- Each project card shows: name, archetype, phase, module count, cost (if any)
- Clicking a card → `router.push(`/project/${id}`)`

**New API: `POST /api/projects/quick-create`**
```typescript
// Request
{ intent: string }  // raw user text, 10-10000 chars

// Response
{ projectId: string, blueprintId: string }

// Implementation
// 1. Extract name from first ~50 chars of intent (or first sentence)
// 2. Use full intent as topic/brief
// 3. Create Project (status: draft)
// 4. Create Blueprint (projectId, targetAudience from intent context)
// 5. Return IDs
```

### 2. Project Page Layout (`/project/[id]`)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ ← VOVAI │ Project Name          │ ● brainstorm │ $0.42  │
├──────────────────────────┬───────────────────────────────┤
│                          │ Structure │ Grade │ Audience  │
│  [Facilitator]           ├───────────────────────────────┤
│  I'll help you design    │                               │
│  this course...          │  📁 Module 1: Foundations     │
│                          │    📄 Topic 1.1: Overview     │
│  Target audience?        │    📄 Topic 1.2: Principles   │
│  [Professionals]         │                               │
│  [Students]              │  📁 Module 2: Applications    │
│  [Teachers]              │    📄 Topic 2.1: Case Studies │
│  [Custom: ___]           │                               │
│                          │                               │
│  [You]                   │                               │
│  Working professionals   │                               │
│  in agriculture          │                               │
│                          │                               │
│  [Agent working...]      │                               │
│                          │                               │
├──────────────────────────┤                               │
│ [Grade] [Approve]        │                               │
│ ┌──────────────────────┐ │                               │
│ │ Type your message... │ │                               │
│ └──────────────────────┘ │                               │
└──────────────────────────┴───────────────────────────────┘
```

**Two columns:**
- Left (55-60%): Chat column
- Right (40-45%): Artifact panel (collapsible)

**Top bar:**
- Back arrow → landing page
- "VOVAI" brand mark
- Project name (editable inline)
- Phase badge (brainstorm/structure/refinement/review/approved) — color-coded
- Session cost — running total

**Chat column (left):**
- Scrollable message area
- Messages rendered as cards (reuse ActivityStream + ActivityCard)
- Agent messages: role avatar, name, content (markdown), optional clickable options
- Human messages: right-aligned, different background
- Active agent indicators (shimmer/pulse animation)
- Bottom area:
  - Phase action buttons (contextual: Proceed, Grade, Approve, Feedback, etc.)
  - Text input, pinned to bottom
  - Enter to send, Shift+Enter for newline

**Artifact panel (right):**
- Tab bar at top: Structure | Grade | Audience | Configure | Launch
- Tabs appear dynamically as content becomes available
- Panel starts hidden (no artifacts yet)
- Auto-opens when first artifact arrives
- Auto-switches tab when new artifact type produced
- Collapse/expand toggle on the divider
- Each tab renders the appropriate component (reused from existing codebase)

**State management:**
```typescript
type ProjectPageState = {
  // Data (fetched)
  project: Project
  blueprint: ProjectBlueprint
  messages: IdeationMessage[]
  nodes: ProjectNode[]
  grade: StructureGrade | null

  // UI state (client)
  activeTab: 'structure' | 'grade' | 'audience' | 'configure' | 'launch'
  panelOpen: boolean
  visibleTabs: Set<string>  // which tabs have content
  inputValue: string
}
```

**Lifecycle:**
1. Page mounts → fetch project, blueprint, messages
2. If no conversation exists AND brief in sessionStorage → auto-start ideation
3. If conversation exists → render all messages, resume at current phase
4. As agents produce artifacts → update `visibleTabs`, auto-open panel
5. Phase transitions happen via chat actions (same API calls as before)

### 3. Chat Message Format with Clickable Options

**Extended message type:**
```typescript
type AgentMessage = {
  role: BrainstormRole
  content: string  // markdown text body

  // Optional: clickable options for the user
  options?: {
    question: string
    choices: {
      id: string
      label: string
      description?: string
    }[]
    allowCustom: boolean   // show "Custom: ___" text input
    multiSelect: boolean   // checkboxes vs radio
  }

  // Optional: artifact produced (triggers panel)
  artifact?: {
    type: 'structure' | 'grade' | 'audience'
    label: string  // tab display text
  }
}
```

**Rendering rules:**
- `content` renders as markdown (paragraphs, lists, bold, etc.)
- If `options` present → render below content as button chips
  - Single-select: clicking sends `choice.label` as user message
  - Multi-select: checkboxes, "Confirm" button sends all selected
  - `allowCustom`: final chip is a text input, Enter to submit
- If `artifact` present → add `artifact.type` to `visibleTabs`, auto-switch panel
- Options become disabled/grayed after the user responds (historical state)

**Orchestrator prompt update:**
- System prompt instructs the agent to return JSON with `content` and `options`
- Agent response parsed server-side, returned as typed `AgentMessage`
- If parsing fails, fallback: entire response as `content`, no `options`

### 4. Artifact Panel Tabs

| Tab | Content | Source | Appears When |
|-----|---------|--------|-------------|
| **Structure** | Interactive tree + node detail | Reuse `TreeView` + `NodeDetail` | Structure phase begins |
| **Grade** | Rubric dimension scores, recommendation, strengths/weaknesses | Extract from `GradeReportModal` | First grading completes |
| **Audience** | Audience profile card (age, level, motivations, pain points) | New component from `AudienceProfile` type | Audience analysis done |
| **Configure** | Multi-step wizard | Reuse `WizardStepper` + all step components | Phase = approved |
| **Launch** | Cost breakdown + handoff button | Reuse launch page content | Configuration complete |

**Structure tab specifics:**
- Split into tree (left) + node detail (right) within the panel
- Component palette accessible via "Add Component" button on nodes
- Editing nodes updates the blueprint in real-time
- Rubric score bar at bottom of structure tab

**Grade tab specifics:**
- 7-dimension score bars with pass/fail indicators
- Overall score prominently displayed
- Recommendation badge (approve/revise/restructure/reject)
- Strengths and weaknesses lists
- "Re-Grade" button triggers grading from within the panel

**Audience tab specifics:**
- Structured display of AudienceProfile data
- Primary audience description, age range, education level
- Prerequisites, learning preferences, motivations, pain points
- Read-only during ideation; editable after approval

**Configure tab specifics:**
- Full wizard experience embedded in the panel
- Steps generated dynamically from enabled components
- Same validation and per-component forms as current wizard
- "Save Configuration" persists without leaving the panel

**Launch tab specifics:**
- Cost estimate breakdown by phase
- Component counts by type
- "Execute Handoff" button
- Success state with job breakdown

### 5. Component Reuse Map

| Existing Component | Fate | New Location |
|-------------------|------|-------------|
| `ActivityStream` | **Reuse** | Chat column message list |
| `ActivityCard` | **Reuse** | Individual chat messages |
| `PhaseActions` | **Refactor** | Chat bottom bar (above input) |
| `PhaseIndicator` | **Compact** | Top bar phase badge |
| `ChatInput` | **Reuse** | Chat bottom input |
| `StructurePreview` | **Remove** | Replaced by full Structure tab |
| `ContextPanels` | **Remove** | Replaced by artifact panel tabs |
| `AgentSidebar` | **Remove** | Cost → top bar, phase → top bar |
| `PcNav` | **Remove** | Replaced by artifact panel tabs |
| `Breadcrumbs` | **Remove** | Top bar handles navigation |
| `TreeView` | **Reuse** | Structure artifact tab |
| `NodeDetail` | **Reuse** | Structure artifact tab |
| `ComponentPalette` | **Reuse** | Structure tab (on-demand) |
| `RubricScoreBar` | **Reuse** | Structure tab bottom / Grade tab |
| `GradeReportModal` | **Extract** | Grade tab (inline, not modal) |
| `WizardStepper` | **Reuse** | Configure artifact tab |
| `WizardStep*` | **Reuse** | Configure artifact tab |
| `EmptyState` | **Reuse** | Empty artifact panel state |
| `ErrorBanner` | **Reuse** | Error states |
| `SkeletonLoader` | **Reuse** | Loading states |
| `RoleAvatar` | **Reuse** | Chat messages |

### 6. New Components to Create

| Component | Purpose |
|-----------|---------|
| `LandingPrompt` | Centered prompt box + send button |
| `RecentProjectsList` | Project cards with status, click to open |
| `ProjectPageLayout` | Two-column chat + artifact shell |
| `ChatColumn` | Message list + actions + input |
| `ArtifactPanel` | Tabbed right panel with collapse |
| `OptionChips` | Clickable option buttons in agent messages |
| `AudienceProfileCard` | Audience tab content |
| `GradeReport` (inline) | Grade tab content (extracted from modal) |
| `CompactPhaseBadge` | Top bar phase indicator |
| `CostBadge` | Top bar cost display |

### 7. API Changes

**New endpoint:**
```
POST /api/projects/quick-create
  Request: { intent: string }
  Response: { projectId: string, blueprintId: string }
  Logic: parse intent → create Project + Blueprint → return IDs
```

**Modified endpoints:**
```
POST /api/blueprints/[id]/ideation/start
POST /api/blueprints/[id]/ideation/message
  → Update orchestrator prompt to return structured format with options
  → Response includes: content, options?, artifact?
  → Backward-compatible: if no options, works as before
```

**Unchanged:** All node, component, grade, version, approve, handoff endpoints.

### 8. Pages Deleted/Replaced

| Route | Action |
|-------|--------|
| `src/app/page.tsx` | **Replace** with landing page (prompt + recent) |
| `src/app/(pages)/project/new/page.tsx` | **Delete** — quick-create replaces form |
| `src/app/(pages)/project/[id]/page.tsx` | **Replace** with chat + artifact layout |
| `src/app/(pages)/project/[id]/ideation/page.tsx` | **Delete** — absorbed into project page |
| `src/app/(pages)/project/[id]/structure/page.tsx` | **Delete** — artifact panel tab |
| `src/app/(pages)/project/[id]/configure/page.tsx` | **Delete** — artifact panel tab |
| `src/app/(pages)/project/[id]/launch/page.tsx` | **Delete** — artifact panel tab |
| `src/app/(pages)/dashboard/page.tsx` | **Keep** — separate concern for now |

### 9. Mobile Behavior

- Single column: chat only (artifact panel hidden)
- Floating action button to open artifact panel as full-screen overlay
- Swipe down or X to close artifact panel
- Tab bar at top of overlay for switching artifact types
- Phase action buttons and input remain at bottom of chat

---

## Implementation Phases

### Phase A: Landing Page (smallest shippable unit)
1. Replace `src/app/page.tsx` with prompt-centered design
2. Create `POST /api/projects/quick-create` endpoint
3. Fetch and display recent projects
4. On Enter: create project, redirect to `/project/[id]`
5. Store brief in sessionStorage for handoff

### Phase B: Chat + Artifact Shell
1. Create new `/project/[id]/page.tsx` with two-column layout
2. Build `ProjectPageLayout` — top bar + chat column + artifact panel
3. Wire up data fetching (project, blueprint, messages)
4. Auto-start ideation if fresh project with brief in sessionStorage
5. Render messages using reused `ActivityStream`/`ActivityCard`
6. Chat input with phase action buttons

### Phase C: Artifact Panel
1. Build tabbed panel with collapse/expand
2. Wire Structure tab (reuse `TreeView` + `NodeDetail`)
3. Wire Grade tab (extract from `GradeReportModal`)
4. Build Audience Profile tab (new component)
5. Wire Configure tab (reuse wizard components)
6. Wire Launch tab (reuse launch content)
7. Auto-open and auto-switch on artifact events

### Phase D: Clickable Options
1. Update orchestrator prompt for structured response format
2. Parse structured responses in API routes
3. Build `OptionChips` component
4. Render options in agent messages
5. Click → send as user message

### Phase E: Cleanup
1. Delete old pages (ideation, structure, configure, launch, new)
2. Remove unused components (PcNav, AgentSidebar, ContextPanels, etc.)
3. Update any remaining links/redirects
4. Verify all flows work end-to-end

---

## Success Criteria

- [ ] User can go from landing page to AI conversation in ONE action (type + Enter)
- [ ] Full ideation flow works without page navigation
- [ ] Structure, grade, audience visible in artifact panel
- [ ] Configuration wizard works within artifact panel
- [ ] Production handoff works from artifact panel
- [ ] Existing projects resumable from landing page
- [ ] Mobile: single-column chat with artifact overlay
- [ ] No regression in ideation agent functionality
- [ ] All existing API endpoints still work
