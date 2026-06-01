import { defineConfig, devices } from "@playwright/test"

// CR-9 e2e. Runs the "you will see" walkthrough against a real dev server +
// dev DB, with the Idea Coach API route mocked at the network layer.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Run against a production build (not `next dev`) — every route is
  // precompiled, which removes the on-demand-compilation timing flakiness.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
