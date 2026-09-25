// Unit tests for the renderer's pure helpers only; the UI itself is checked in the browser preview.
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  test: {
    environment: 'node',
    include: ['src/renderer/src/lib/**/*.test.ts'],
  },
})
