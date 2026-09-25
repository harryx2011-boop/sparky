#!/usr/bin/env node
// Writes the landing site's Tools list from the real op registry, through the built CLI.
// The JSON is committed: the Vercel build has no CLI, so the site reads the file, never the registry.
//
//   npm run build:cli && node scripts/gen-site-ops.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const cli = path.join(root, 'packages/cli/dist/sparky.js')
const out = path.join(root, 'apps/web/src/data/ops.json')

if (!fs.existsSync(cli)) {
  console.error('packages/cli/dist/sparky.js is missing. Run `npm run build:cli` first.')
  process.exit(1)
}

// --local keeps the listing off a running app, so the output depends only on this checkout.
const raw = execFileSync(process.execPath, [cli, 'ops', '--json', '--local'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const { ops } = JSON.parse(raw)
if (!Array.isArray(ops) || ops.length === 0) throw new Error('`sparky ops --json` returned no ops')

const slim = ops.map((op) => ({
  id: op.id,
  label: op.label,
  category: op.category,
  fields: Object.values(op.inputSchema?.properties ?? {})
    .map((p) => p?.title)
    .filter((t) => typeof t === 'string' && t.length > 0),
}))

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `${JSON.stringify(slim, null, 2)}\n`)
console.log(`✓ ${path.relative(root, out)}: ${slim.length} ops`)
