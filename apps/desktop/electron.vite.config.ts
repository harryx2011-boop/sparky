import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

// @sparky/* workspace packages are TypeScript source, so they are bundled rather than externalized.
const bundleWorkspace = externalizeDepsPlugin({ exclude: ['@sparky/core', '@sparky/ui'] })

export default defineConfig({
  main: {
    plugins: [bundleWorkspace],
  },
  preload: {
    plugins: [bundleWorkspace],
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react(), tailwindcss()],
    build: { minify: true },
  },
})
