import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    passWithNoTests: true,
    // CR-0: archived eLearn code lives under src/ and tests/ but must not run.
    exclude: [
      ...configDefaults.exclude,
      'tests/e2e/**',
      'tests/_eLearn_archive/**',
      'src/_eLearn_archive_api/**',
      'src/_eLearn_archive_pages/**',
      'src/_eLearn_archive_components/**',
      'src/_eLearn_archive_lib/**',
      'src/_eLearn_archive_scripts/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
