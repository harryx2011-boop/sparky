#!/usr/bin/env node
// Downloads the Windows builds of the tools Sparky bundles into apps/desktop/resources/bin.
// They are not committed to git; the installer ships them so users need no setup.
//
//   node scripts/fetch-tools.mjs            fetch anything missing
//   node scripts/fetch-tools.mjs --force    fetch everything again
//
// Set GITHUB_TOKEN to avoid GitHub's API rate limit on shared CI runners.
//
// `fetchTools({ binDir, force })` is the same work as a function; `sparky setup` calls it for npm installs that have no app.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = fileURLToPath(import.meta.url)
const root = path.dirname(path.dirname(here))
const headers = {
  'User-Agent': 'sparky-fetch-tools',
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

/** Each tool: where it comes from and which files to keep. */
const TOOLS = [
  {
    id: 'yt-dlp',
    repo: 'yt-dlp/yt-dlp',
    asset: /^yt-dlp\.exe$/,
    keep: ['yt-dlp.exe'],
    license: 'Unlicense',
  },
  {
    id: 'ffmpeg',
    repo: 'BtbN/FFmpeg-Builds',
    tag: 'latest',
    // The oldest release branch, not master: newer FFmpeg needs a newer graphics driver for NVIDIA speed
    // (master and 9.0 need driver 610+, which most PCs don't have yet).
    asset: /^ffmpeg-n[\d.]+-latest-win64-gpl-[\d.]+\.zip$/,
    pick: (assets) => assets.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))[0],
    keep: ['ffmpeg.exe', 'ffprobe.exe'],
    license: 'GPL-3.0 (https://ffmpeg.org, source: https://github.com/BtbN/FFmpeg-Builds)',
  },
  {
    id: 'pandoc',
    repo: 'jgm/pandoc',
    asset: /^pandoc-[\d.]+-windows-x86_64\.zip$/,
    keep: ['pandoc.exe'],
    license: 'GPL-2.0-or-later (source: https://github.com/jgm/pandoc)',
  },
  {
    id: '7zip',
    repo: 'ip7z/7zip',
    // The full 7-Zip (7z.exe + 7z.dll) can open RAR archives; the standalone 7za can't.
    asset: /^7z\d+-x64\.exe$/,
    keep: ['7z.exe', '7z.dll'],
    fallback: { asset: /^7z\d+-extra\.7z$/, keep: ['x64/7za.exe', 'x64/7za.dll', 'x64/7zxa.dll'] },
    license: 'LGPL-2.1 with unRAR restriction (https://www.7-zip.org/license.txt)',
  },
  {
    id: 'deno',
    repo: 'denoland/deno',
    asset: /^deno-x86_64-pc-windows-msvc\.zip$/,
    keep: ['deno.exe'],
    license: 'MIT (https://github.com/denoland/deno)',
  },
]

/** Data files fetched as they are (no release, no unpacking). `gzip` stores them compressed, the way tesseract.js reads them. */
const DATA = [
  {
    id: 'tessdata-eng',
    // The fast LSTM English model (about 4 MB) for OCR; other languages download on demand.
    url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata',
    dest: 'tessdata/eng.traineddata.gz',
    gzip: true,
    version: '4.1.0',
    license: 'Apache-2.0 (https://github.com/tesseract-ocr/tessdata_fast)',
  },
]

async function fetchData(item, { binDir, force, log, write }) {
  const dest = path.join(binDir, item.dest)
  if (fs.existsSync(dest) && !force) {
    log(`✓ ${item.id} already present`)
    return undefined
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `sparky-${item.id}-`))
  try {
    const file = path.join(work, path.basename(new URL(item.url).pathname))
    log(`↓ ${item.id} ${item.version} (${path.basename(file)})`)
    await download(item.url, file, write)
    const body = fs.readFileSync(file)
    fs.writeFileSync(dest, item.gzip ? gzipSync(body, { level: 9 }) : body)
    return { id: item.id, version: item.version, asset: item.url, license: item.license }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

async function release(repo, tag) {
  const url = `https://api.github.com/repos/${repo}/releases/${tag ? `tags/${tag}` : 'latest'}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${repo}: GitHub answered ${res.status} for ${url}`)
  return res.json()
}

async function download(url, dest, write) {
  const res = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  let got = 0
  let lastPct = -10
  const file = fs.createWriteStream(dest)
  for await (const chunk of res.body) {
    file.write(chunk)
    got += chunk.length
    const pct = total ? Math.floor((got / total) * 100) : 0
    if (pct >= lastPct + 10) {
      write(`  ${pct}%`)
      lastPct = pct
    }
  }
  await new Promise((r) => file.end(r))
  write('\n')
}

/**
 * Finds something that can unpack .zip, .7z and the 7-Zip installer: an installed 7-Zip, else 7zip-bin's 7za.
 * `path7za` is 7zip-bin's path as the caller resolved it; a bundled caller passes it, since this file's own location
 * says nothing about where its node_modules are.
 *
 * @param {{ path7za?: string }} [opts]
 * @returns {string}
 */
export function findExtractor({ path7za } = {}) {
  const candidates = [
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', '7-Zip', '7z.exe'),
    '/usr/bin/7z',
    '/usr/bin/7zz',
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  let bin = path7za
  if (!bin) {
    try {
      bin = createRequire(path.join(root, 'package.json'))('7zip-bin').path7za
    } catch {
      bin = undefined
    }
  }
  if (!bin || !fs.existsSync(bin)) throw new Error('Need 7-Zip to unpack the downloads. Install it, or run "npm install" so the 7zip-bin package is available.')
  // npm drops the execute bit on 7zip-bin's Linux and macOS binaries.
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755)
  return bin
}

/** True when every tool's files are in `dir` (either download option counts). */
function toolPresent(tool, dir) {
  const has = (keep) => keep.every((k) => fs.existsSync(path.join(dir, path.basename(k))))
  return has(tool.keep) || Boolean(tool.fallback && has(tool.fallback.keep))
}

/**
 * What fetchTools would do, without doing it.
 *
 * @param {{ binDir: string, force?: boolean }} opts
 * @returns {{ id: string, present: boolean, from: string, to: string }[]}
 */
export function planTools({ binDir, force = false }) {
  return [
    ...TOOLS.map((t) => ({ id: t.id, present: !force && toolPresent(t, binDir), from: `https://github.com/${t.repo}/releases`, to: binDir })),
    ...DATA.map((d) => ({ id: d.id, present: !force && fs.existsSync(path.join(binDir, d.dest)), from: d.url, to: path.join(binDir, d.dest) })),
  ]
}

/** True when `dir` already holds every tool and data file, as the installed app's resources\bin does. */
export function hasAllTools(dir) {
  return planTools({ binDir: dir }).every((p) => p.present)
}

function findFile(dir, relative) {
  const want = relative.toLowerCase().replace(/\\/g, '/')
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (full.toLowerCase().replace(/\\/g, '/').endsWith(`/${want}`)) return full
    }
  }
  return undefined
}

async function fetchTool(tool, unpack, { binDir, force, log, write }) {
  const already = tool.keep.every((k) => fs.existsSync(path.join(binDir, path.basename(k))))
  if (already && !force) {
    log(`✓ ${tool.id} already present`)
    return undefined
  }
  const rel = await release(tool.repo, tool.tag)
  const attempts = [{ asset: tool.asset, keep: tool.keep }, ...(tool.fallback ? [tool.fallback] : [])]
  for (const attempt of attempts) {
    const matches = rel.assets.filter((a) => attempt.asset.test(a.name))
    const asset = tool.pick ? tool.pick(matches) : matches[0]
    if (!asset) continue
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `sparky-${tool.id}-`))
    try {
      const file = path.join(work, asset.name)
      log(`↓ ${tool.id} ${rel.tag_name} (${asset.name})`)
      await download(asset.browser_download_url, file, write)
      if (/\.exe$/i.test(asset.name) && attempt.keep.length === 1 && attempt.keep[0] === asset.name) {
        fs.copyFileSync(file, path.join(binDir, asset.name))
      } else {
        const out = path.join(work, 'x')
        try {
          execFileSync(unpack, ['x', '-y', `-o${out}`, file], { stdio: 'ignore' })
        } catch {
          log(`  could not unpack ${asset.name}, trying the next option`)
          continue
        }
        const found = attempt.keep.map((k) => [k, findFile(out, k)])
        const missing = found.filter(([, f]) => !f).map(([k]) => k)
        if (missing.length) {
          log(`  ${asset.name} is missing ${missing.join(', ')}, trying the next option`)
          continue
        }
        for (const [, f] of found) fs.copyFileSync(f, path.join(binDir, path.basename(f)))
      }
      return { id: tool.id, version: rel.tag_name, asset: asset.name, license: tool.license }
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  }
  throw new Error(`${tool.id}: no usable download in ${tool.repo} ${rel.tag_name}`)
}

/**
 * Fetches every tool and data file into `binDir` and updates its VERSIONS.json.
 * Returns the ids that failed; the others are in place either way.
 *
 * @param {{ binDir: string, force?: boolean, log?: (line: string) => void, warn?: (line: string) => void, write?: (text: string) => void, path7za?: string }} opts
 * @returns {Promise<{ ok: boolean, failed: string[], binDir: string }>}
 */
export async function fetchTools({ binDir, force = false, log = console.log, warn = console.error, write = (t) => process.stdout.write(t), path7za }) {
  const io = { binDir, force, log, write }
  fs.mkdirSync(binDir, { recursive: true })
  const unpack = findExtractor({ path7za })
  const manifestFile = path.join(binDir, 'VERSIONS.json')
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}
  const failed = []
  for (const tool of TOOLS) {
    try {
      const info = await fetchTool(tool, unpack, io)
      if (info) manifest[info.id] = info
    } catch (e) {
      failed.push(tool.id)
      warn(`✗ ${tool.id}: ${e.message}`)
    }
  }
  for (const item of DATA) {
    try {
      const info = await fetchData(item, io)
      if (info) manifest[info.id] = info
    } catch (e) {
      failed.push(item.id)
      warn(`✗ ${item.id}: ${e.message}`)
    }
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return { ok: failed.length === 0, failed, binDir }
}

// Run as a script only when this file itself is the entry point, never when bundled into another program.
// Compared as real paths, case-insensitively on Windows, so a linked folder or a lower-case drive letter still counts.
function isEntry() {
  if (path.basename(here) !== 'fetch-tools.mjs' || !process.argv[1]) return false
  try {
    const a = pathToFileURL(fs.realpathSync(process.argv[1])).href
    const b = pathToFileURL(fs.realpathSync(here)).href
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
  } catch {
    return false
  }
}
if (isEntry()) {
  const binDir = path.join(root, 'apps/desktop/resources/bin')
  const { ok } = await fetchTools({ binDir, force: process.argv.includes('--force') })
  console.log(`\nTools are in ${path.relative(root, binDir)}`)
  if (!ok) process.exit(1)
}
