import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-build.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
