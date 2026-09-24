// Renders the Sparky bolt into the PNG icons the app and installer use.
// Run with: node scripts/make-icons.mjs (uses the sharp dependency from apps/desktop).
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(path.join(root, 'apps/desktop/package.json'))
const sharp = require('sharp')

const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="16" fill="#EDEDED"/>
  <path d="M34.7 12 16 35.6h18.5L31.8 52 50.5 28.4H32L34.7 12z" fill="none" stroke="#0A0A0A" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const outputs = [
  ['apps/desktop/build/icon.png', 512],
  ['apps/desktop/resources/icon.png', 256],
  ['apps/desktop/resources/tray.png', 32],
]

for (const [file, size] of outputs) {
  await sharp(Buffer.from(tile), { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size)
    .png()
    .toFile(path.join(root, file))
  console.log('wrote', file)
}
