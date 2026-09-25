import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// BASE_PATH serves the site from a subfolder (e.g. "/sparky/"); Vercel serves it from the root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: { port: 4600, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        download: fileURLToPath(new URL('./download.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['motion/react'],
        },
      },
    },
  },
})
