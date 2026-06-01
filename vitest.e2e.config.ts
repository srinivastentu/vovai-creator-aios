import { defineConfig } from 'vitest/config'
import path from 'path'

// Dedicated config for the heavyweight V1 acceptance test (CR-12). It runs in a
// real Node environment (not jsdom), makes live model calls, and hits the dev
// DB — so it is isolated from vitest.config.ts (which EXCLUDES tests/e2e/**).
// Run via `npm run test:acceptance`.
//
// `include` names only the one file (never accidentally picks up unit tests),
// `setupFiles` loads .env.local before the test module imports, and a single
// test file → a single process → one CostLedger / one billed run.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/e2e/v1-acceptance.test.ts'],
    setupFiles: ['./tests/e2e/acceptance-setup.ts'],
    testTimeout: 40 * 60_000, // 40 min — safety net above the < 30-min acceptance bar
    hookTimeout: 5 * 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
