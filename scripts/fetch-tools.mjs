#!/usr/bin/env node
// Downloads the Windows builds of the tools Sparky bundles into apps/desktop/resources/bin.
// They are not committed to git; the installer ships them so users need no setup.
//
//   node scripts/fetch-tools.mjs            fetch anything missing
//   node scripts/fetch-tools.mjs --force    fetch everything again
//
// Set GITHUB_TOKEN to avoid GitHub's API rate limit on shared CI runners.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const binDir = path.join(root, 'apps/desktop/resources/bin')
const force = process.argv.includes('--force')
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
    asset: /^ffmpeg-master-latest-win64-gpl\.zip$/,
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

async function release(repo, tag) {
  const url = `https://api.github.com/repos/${repo}/releases/${tag ? `tags/${tag}` : 'latest'}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${repo}: GitHub answered ${res.status} for ${url}`)
  return res.json()
}

async function download(url, dest) {
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
      process.stdout.write(`  ${pct}%`)
      lastPct = pct
    }
  }
  await new Promise((r) => file.end(r))
  process.stdout.write('\n')
}

/** Finds something that can unpack .zip, .7z and the 7-Zip installer. */
function extractor() {
  const candidates = [
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', '7-Zip', '7z.exe'),
    '/usr/bin/7z',
    '/usr/bin/7zz',
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  try {
    const require = createRequire(path.join(root, 'package.json'))
    return require('7zip-bin').path7za
  } catch {
    throw new Error('Need 7-Zip to unpack the downloads. Install it, or run "npm install" so the 7zip-bin package is available.')
  }
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

async function fetchTool(tool, unpack) {
  const already = tool.keep.every((k) => fs.existsSync(path.join(binDir, path.basename(k))))
  if (already && !force) {
    console.log(`✓ ${tool.id} already present`)
    return undefined
  }
  const rel = await release(tool.repo, tool.tag)
  const attempts = [{ asset: tool.asset, keep: tool.keep }, ...(tool.fallback ? [tool.fallback] : [])]
  for (const attempt of attempts) {
    const asset = rel.assets.find((a) => attempt.asset.test(a.name))
    if (!asset) continue
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `sparky-${tool.id}-`))
    try {
      const file = path.join(work, asset.name)
      console.log(`↓ ${tool.id} ${rel.tag_name} (${asset.name})`)
      await download(asset.browser_download_url, file)
      if (/\.exe$/i.test(asset.name) && attempt.keep.length === 1 && attempt.keep[0] === asset.name) {
        fs.copyFileSync(file, path.join(binDir, asset.name))
      } else {
        const out = path.join(work, 'x')
        try {
          execFileSync(unpack, ['x', '-y', `-o${out}`, file], { stdio: 'ignore' })
        } catch {
          console.log(`  could not unpack ${asset.name}, trying the next option`)
          continue
        }
        const found = attempt.keep.map((k) => [k, findFile(out, k)])
        const missing = found.filter(([, f]) => !f).map(([k]) => k)
        if (missing.length) {
          console.log(`  ${asset.name} is missing ${missing.join(', ')}, trying the next option`)
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

fs.mkdirSync(binDir, { recursive: true })
const unpack = extractor()
const manifestFile = path.join(binDir, 'VERSIONS.json')
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}
let failed = false
for (const tool of TOOLS) {
  try {
    const info = await fetchTool(tool, unpack)
    if (info) manifest[info.id] = info
  } catch (e) {
    failed = true
    console.error(`✗ ${tool.id}: ${e.message}`)
  }
}
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`\nTools are in ${path.relative(root, binDir)}`)
if (failed) process.exit(1)
