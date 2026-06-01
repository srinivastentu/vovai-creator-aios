import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Idea } from "@/generated/prisma/client"

// IdeaRow calls useRouter() at render; stub next/navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

import { IdeaRow } from "@/components/ideas/IdeaRow"

const idea: Idea = {
  id: "i1",
  workspaceId: "w1",
  title: "Agentic AI title",
  description: "A description",
  niches: ["AI"],
  sourceUrl: null,
  status: "captured",
  promotedAt: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
}

describe("IdeaRow selectable migration", () => {
  it("keeps the title heading OUTSIDE any interactive ancestor", () => {
    // Chromium strips role=heading from an <h3> nested inside a <button>, which
    // would break the e2e getByRole('heading') after Idea Coach adds a title.
    // The selection affordance must therefore be a sibling overlay, not a wrapper.
    render(<IdeaRow idea={idea} selected onSelect={() => {}} />)
    const heading = screen.getByRole("heading", { name: "Agentic AI title" })
    expect(heading.closest("button")).toBeNull()
  })

  it("exposes a sibling selection control when onSelect is provided", () => {
    render(<IdeaRow idea={idea} onSelect={() => {}} />)
    expect(screen.getByRole("button", { name: /preview agentic ai title/i })).toBeInTheDocument()
  })

  it("still renders the title heading with no select handler", () => {
    render(<IdeaRow idea={idea} />)
    expect(screen.getByRole("heading", { name: "Agentic AI title" })).toBeInTheDocument()
  })
})
