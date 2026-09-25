#!/usr/bin/env node
// Downloads Satoshi (Indian Type Foundry, free via Fontshare) into the site and the app.
// The font files aren't committed; the Vercel build and the Release workflow run this before building.
// Without it, both fall back to the next fonts in the stack.
//
//   node scripts/fetch-fonts.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const targets = [path.join(root, 'apps/web/public/fonts/satoshi'), path.join(root, 'apps/desktop/src/renderer/public/fonts/satoshi')]
const wanted = ['Satoshi-Variable.woff2', 'Satoshi-VariableItalic.woff2']

if (!process.argv.includes('--force') && targets.every((t) => wanted.every((w) => fs.existsSync(path.join(t, w))))) {
  console.log('✓ Satoshi already present')
  process.exit(0)
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-fonts-'))
try {
  const res = await fetch('https://api.fontshare.com/v2/fonts/download/satoshi', { headers: { 'User-Agent': 'sparky-fetch-fonts' } })
  if (!res.ok) throw new Error(`Fontshare answered ${res.status}`)
  const zip = path.join(work, 'satoshi.zip')
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  const require = createRequire(path.join(root, 'package.json'))
  const sevenZip = require('7zip-bin').path7za
  // npm drops the execute bit on Linux (Vercel's build container), so 7za fails with EACCES without this.
  if (process.platform !== 'win32') fs.chmodSync(sevenZip, 0o755)
  execFileSync(sevenZip, ['x', '-y', `-o${path.join(work, 'x')}`, zip], { stdio: 'ignore' })

  const found = new Map()
  const stack = [path.join(work, 'x')]
  while (stack.length) {
    const d = stack.pop()
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (wanted.includes(e.name)) found.set(e.name, full)
    }
  }
  const missing = wanted.filter((w) => !found.has(w))
  if (missing.length) throw new Error(`The download didn't include ${missing.join(', ')}`)
  for (const t of targets) {
    fs.mkdirSync(t, { recursive: true })
    for (const [name, file] of found) fs.copyFileSync(file, path.join(t, name))
  }
  console.log(`✓ Satoshi copied into ${targets.map((t) => path.relative(root, t)).join(' and ')}`)
} catch (e) {
  console.error(`✗ Couldn't fetch Satoshi: ${e.message}. The site and app will use the fallback fonts.`)
  process.exitCode = 1
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
