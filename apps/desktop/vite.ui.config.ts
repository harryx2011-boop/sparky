// Runs just the interface in a browser with a mock backend: npm run dev:ui -w @sparky/desktop
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  plugins: [react(), tailwindcss()],
  build: { outDir: resolve(__dirname, 'out/ui-preview'), emptyOutDir: true },
})
