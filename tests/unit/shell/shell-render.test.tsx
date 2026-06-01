import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { GovernanceRibbonData } from "@/components/shell/types"

// The shell uses next/navigation + next/link. Stub both so the components
// render in jsdom without the Next App Router runtime.
vi.mock("next/navigation", () => ({ usePathname: () => "/personas" }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}))

import { AppFrame } from "@/components/shell/AppFrame"
import { NavRail } from "@/components/shell/NavRail"
import { PreviewPane } from "@/components/shell/PreviewPane"
import { GovernanceRibbon } from "@/components/shell/GovernanceRibbon"
import { PersonaPreview } from "@/components/shell/previews/PersonaPreview"
import { IdeaPreview } from "@/components/shell/previews/IdeaPreview"
import { MasterPreview } from "@/components/shell/previews/MasterPreview"
import { LinkedInPreview } from "@/components/shell/previews/LinkedInPreview"
import { ArticlePreview } from "@/components/shell/previews/ArticlePreview"

const RIBBON: GovernanceRibbonData = {
  versionLabel: "v2 · LinkedIn post",
  modelLineage: ["Claude", "GPT-4o", "Gemini judge"],
  score: 91.3,
  threshold: 80,
  iterations: 2,
  costUSD: 0.1538,
  approval: "in_review",
  deterministic: false,
}

describe("PreviewPane", () => {
  it("renders supplied content", () => {
    render(<PreviewPane>{<div>RENDERED ARTIFACT</div>}</PreviewPane>)
    expect(screen.getByText("RENDERED ARTIFACT")).toBeInTheDocument()
  })

  it("shows an empty state when nothing is selected", () => {
    render(<PreviewPane empty={{ title: "Select a persona" }} />)
    expect(screen.getByText("Select a persona")).toBeInTheDocument()
  })
})

describe("GovernanceRibbon", () => {
  it("shows live governance data", () => {
    render(<GovernanceRibbon data={RIBBON} />)
    expect(screen.getByText("v2 · LinkedIn post")).toBeInTheDocument()
    expect(screen.getByText("Claude → GPT-4o → Gemini judge")).toBeInTheDocument()
    expect(screen.getByText(/91\.3/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.1538/)).toBeInTheDocument()
    expect(screen.getByText("In review")).toBeInTheDocument()
  })

  it("collapses to a deterministic label for Gate A masters", () => {
    render(<GovernanceRibbon data={{ ...RIBBON, deterministic: true, score: null }} />)
    expect(screen.getByText("Deterministic synthesis")).toBeInTheDocument()
    expect(screen.queryByText(/91\.3/)).not.toBeInTheDocument()
  })
})

describe("NavRail", () => {
  it("expands then collapses to hide labels", () => {
    render(<NavRail />)
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /collapse navigation/i }))
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })
})

describe("AppFrame", () => {
  it("renders the standard variant with left + preview and no ribbon", () => {
    render(
      <AppFrame
        variant="standard"
        breadcrumbs={[{ label: "Personas" }]}
        left={<div>LEFT COLUMN</div>}
        preview={<div>PREVIEW PANE</div>}
        ribbon={RIBBON}
      />,
    )
    expect(screen.getByText("LEFT COLUMN")).toBeInTheDocument()
    expect(screen.getByText("PREVIEW PANE")).toBeInTheDocument()
    expect(screen.getByText("Dashboard")).toBeInTheDocument() // rail expanded
    expect(screen.queryByText("Deterministic synthesis")).not.toBeInTheDocument()
    expect(screen.queryByText("v2 · LinkedIn post")).not.toBeInTheDocument() // no ribbon
  })

  it("renders the review variant with the governance ribbon and a collapsed rail", () => {
    render(
      <AppFrame
        variant="review"
        breadcrumbs={[{ label: "Gate B" }]}
        left={<div>REVIEW LEFT</div>}
        preview={<div>REVIEW PREVIEW</div>}
        ribbon={RIBBON}
      />,
    )
    expect(screen.getByText("REVIEW LEFT")).toBeInTheDocument()
    expect(screen.getByText("v2 · LinkedIn post")).toBeInTheDocument() // ribbon present
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument() // rail auto-collapsed
  })
})

describe("preview components", () => {
  it("PersonaPreview renders voice + name", () => {
    render(
      <PersonaPreview
        persona={{
          name: "BuildOS Creator",
          niches: ["agentic AI"],
          voiceTone: { formality: "casual", vocabulary: "plain", signaturePhrases: ["ship it"], doNotSay: [] },
          audienceProfile: {
            primaryRole: "Engineer",
            experienceLevel: "Senior",
            interests: [],
            painPoints: [],
            whatTheyWant: "",
          },
          creatorProfile: {
            name: "BuildOS Creator",
            bio: "Builds in public",
            expertiseAreas: [],
            pointOfView: "",
            signatureHooks: [],
            credibilityMarkers: [],
          },
        }}
      />,
    )
    expect(screen.getByText("BuildOS Creator")).toBeInTheDocument()
    expect(screen.getByText("ship it")).toBeInTheDocument()
  })

  it("IdeaPreview renders title + status", () => {
    render(<IdeaPreview idea={{ title: "My Idea", description: "desc", niches: ["AI"], status: "captured" }} />)
    expect(screen.getByText("My Idea")).toBeInTheDocument()
    expect(screen.getByText("Captured")).toBeInTheDocument()
  })

  it("MasterPreview renders the title + section heading", () => {
    render(
      <MasterPreview
        master={{ title: "The Master", sections: [{ heading: "Intro", contentMarkdown: "Hello world" }] }}
      />,
    )
    expect(screen.getByText("The Master")).toBeInTheDocument()
    expect(screen.getByText("Intro")).toBeInTheDocument()
    expect(screen.getByText(/Hello world/)).toBeInTheDocument()
  })

  it("LinkedInPreview renders the body + author + reactions", () => {
    render(<LinkedInPreview body={"Line one\nLine two"} authorName="BuildOS" />)
    expect(screen.getByText(/Line one/)).toBeInTheDocument()
    expect(screen.getByText(/BuildOS/)).toBeInTheDocument()
    expect(screen.getByText("Like")).toBeInTheDocument()
  })

  it("ArticlePreview renders the title + markdown body", () => {
    render(<ArticlePreview body={"## Heading\n\nSome text"} title="The Title" byline="By Creator" />)
    expect(screen.getByText("The Title")).toBeInTheDocument()
    expect(screen.getByText("Heading")).toBeInTheDocument()
    expect(screen.getByText(/Some text/)).toBeInTheDocument()
  })
})
