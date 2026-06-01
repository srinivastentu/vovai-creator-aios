import { test, expect } from "@playwright/test"

// The CR-9 "you will see" walkthrough:
// persona → workspace → idea (quick-add + filter) → Idea Coach (mocked).
// Names are timestamped so repeated runs don't collide in the dev DB.

const stamp = Date.now()
const PERSONA = `E2E Persona ${stamp}`
const WORKSPACE = `E2E Workspace ${stamp}`
const IDEA = `E2E Idea ${stamp}`

test("persona → workspace → ideas → coach", async ({ page }) => {
  // 1) Create a persona ------------------------------------------------------
  await page.goto("/personas/new")
  await page.getByLabel("Name", { exact: true }).fill(PERSONA)
  const personaNiche = page.getByPlaceholder("Add a niche…").first()
  await personaNiche.fill("AI")
  await personaNiche.press("Enter")
  await page.getByRole("button", { name: /create persona/i }).click()
  await expect(page).toHaveURL(/\/personas$/)
  await expect(page.getByText(PERSONA)).toBeVisible()

  // 2) Create a workspace using that persona (+ a niche for the coach) -------
  await page.goto("/workspaces/new")
  await page.getByLabel("Name", { exact: true }).fill(WORKSPACE)
  await page.locator('[data-slot="select-trigger"]').click()
  await page.getByRole("option", { name: PERSONA }).click()
  const wsNiche = page.getByPlaceholder("Add a niche…").first()
  await wsNiche.fill("AI")
  await wsNiche.press("Enter")
  await page.getByRole("button", { name: /create workspace/i }).click()
  await expect(page.getByRole("heading", { name: WORKSPACE })).toBeVisible()

  // 3) Quick-add an idea, then narrow with the status filter -----------------
  await page.getByRole("link", { name: /go to idealog/i }).click()
  await expect(page).toHaveURL(/\/ideas$/)
  await page.getByPlaceholder("Capture an idea…").fill(IDEA)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(page.getByText(IDEA)).toBeVisible()

  // status filter → "In progress" hides the captured idea. With no niched
  // ideas yet, the status select is the only filter trigger on the page.
  const statusFilter = page.locator('[data-slot="select-trigger"]').first()
  await statusFilter.click()
  await page.getByRole("option", { name: "In progress" }).click()
  await expect(page.getByText(IDEA)).toHaveCount(0)
  // reset back to all
  await statusFilter.click()
  await page.getByRole("option", { name: "All statuses" }).click()
  await expect(page.getByText(IDEA)).toBeVisible()

  // 4) Idea Coach with the route mocked --------------------------------------
  const COACHED = `Coached title one ${stamp}`
  await page.route("**/api/workspaces/*/ideas/coach", async (route) => {
    await route.fulfill({
      json: {
        proposals: [
          { title: COACHED, angle: "A concrete angle for AI builders to try this week." },
          { title: `Coached title two ${stamp}`, angle: "Why disciplined loops beat reaching for a bigger model." },
          { title: `Coached title three ${stamp}`, angle: "Where human gates pay off in a content pipeline." },
        ],
      },
    })
  })

  await page.getByRole("button", { name: /idea coach/i }).click()
  await page.getByLabel("Umbrella topic").fill("Agentic AI development")
  await page.getByRole("button", { name: /propose titles/i }).click()

  await expect(page.getByText(COACHED)).toBeVisible()
  await page.getByRole("button", { name: /add to log/i }).first().click()
  await expect(page.getByText(/^Added/).first()).toBeVisible()

  // close the modal → the added idea is visible in the table behind (as an
  // idea-row heading, distinct from the modal's "Added …" card text)
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByRole("heading", { name: COACHED })).toBeVisible()
})
