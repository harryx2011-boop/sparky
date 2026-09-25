// Renders the Sparky bolt into the icons the app and installer use, plus the installer's side and header images.
// Run with: node scripts/make-icons.mjs (uses the sharp dependency from apps/desktop).
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(path.join(root, 'apps/desktop/package.json'))
const sharp = require('sharp')

const mark = `<rect x="2" y="2" width="60" height="60" rx="16" fill="#0A0A0A" stroke="#2A2A2A" stroke-width="1.5"/>
  <path d="M34.7 12 16 35.6h18.5L31.8 52 50.5 28.4H32L34.7 12z" fill="none" stroke="#EDEDED" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark}</svg>`

const png = (size) => sharp(Buffer.from(tile), { density: Math.ceil((72 * size) / 64) * 2 }).resize(size, size).png().toBuffer()

// An ICO holding PNG images, one per size; Windows picks the closest for each place it shows the icon.
async function ico(sizes) {
  const images = await Promise.all(sizes.map(png))
  const header = Buffer.alloc(6 + 16 * sizes.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(images[i].length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += images[i].length
  })
  return Buffer.concat([header, ...images])
}

// NSIS only reads 24-bit BMP files.
async function bmp(svg, width, height) {
  const { data } = await sharp(Buffer.from(svg)).resize(width, height).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
  const stride = Math.ceil((width * 3) / 4) * 4
  const out = Buffer.alloc(54 + stride * height)
  out.write('BM', 0)
  out.writeUInt32LE(out.length, 2)
  out.writeUInt32LE(54, 10)
  out.writeUInt32LE(40, 14)
  out.writeInt32LE(width, 18)
  out.writeInt32LE(height, 22)
  out.writeUInt16LE(1, 26)
  out.writeUInt16LE(24, 28)
  out.writeUInt32LE(stride * height, 34)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3
      out[row + x * 3] = data[s + 2]
      out[row + x * 3 + 1] = data[s + 1]
      out[row + x * 3 + 2] = data[s]
    }
  }
  return out
}

const font = `font-family="Segoe UI, Arial, sans-serif"`
const sidebar = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
  <rect width="164" height="314" fill="#0A0A0A"/>
  <g transform="translate(46 64) scale(1.125)">${mark}</g>
  <text x="82" y="176" text-anchor="middle" ${font} font-size="24" font-weight="700" fill="#EDEDED">Sparky</text>
  <text x="82" y="204" text-anchor="middle" ${font} font-size="11" fill="#A1A1A1">Convert anything.</text>
  <text x="82" y="220" text-anchor="middle" ${font} font-size="11" fill="#A1A1A1">Download everything.</text>
</svg>`
const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  <rect width="150" height="57" fill="#FFFFFF"/>
  <g transform="translate(104 10.5) scale(0.5625)">${mark}</g>
</svg>`

const outputs = [
  ['apps/desktop/build/icon.png', () => png(512)],
  ['apps/desktop/build/icon.ico', () => ico([16, 24, 32, 48, 64, 128, 256])],
  ['apps/desktop/build/installerSidebar.bmp', () => bmp(sidebar, 164, 314)],
  ['apps/desktop/build/installerHeader.bmp', () => bmp(header, 150, 57)],
  ['apps/desktop/resources/icon.png', () => png(256)],
  ['apps/desktop/resources/tray.png', () => png(32)],
]

for (const [file, make] of outputs) {
  fs.writeFileSync(path.join(root, file), await make())
  console.log('wrote', file)
}
