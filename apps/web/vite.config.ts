import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'

const base = process.env.BASE_PATH ?? '/'

// /docs and /docs/<page> are one entry (docs.html) that reads its page from the path; vercel.json does the same rewrite.
// /privacy and /terms are one entry each (privacy.html, terms.html).
const rewriteDocs: Connect.NextHandleFunction = (req, _res, next) => {
  const path = (req.url ?? '').split('?')[0]!
  if (path === `${base}docs` || path.startsWith(`${base}docs/`)) req.url = `${base}docs.html`
  for (const page of ['privacy', 'terms']) if (path === `${base}${page}`) req.url = `${base}${page}.html`
  next()
}
const docsRoute: Plugin = {
  name: 'docs-route',
  configureServer: (s) => void s.middlewares.use(rewriteDocs),
  configurePreviewServer: (s) => void s.middlewares.use(rewriteDocs),
}

// BASE_PATH serves the site from a subfolder (e.g. "/sparky/"); Vercel serves it from the root.
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), docsRoute],
  server: { port: 4600, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        download: fileURLToPath(new URL('./download.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
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
