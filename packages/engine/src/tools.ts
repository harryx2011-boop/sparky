// Finds the bundled tools, checks their versions and tests the graphics card encoders.
import { describeGpu, gpuTestArgs, OPTIONAL_TOOLS, parseEncoderList, TOOL_LABELS, type GpuInfo, type ToolStatus } from '@sparky/core'
import fs from 'node:fs'
import path from 'node:path'
import { run } from './process'

export type ToolId = ToolStatus['id']

export interface Tools {
  ffmpeg?: string
  ffprobe?: string
  'yt-dlp'?: string
  pandoc?: string
  '7zip'?: string
  deno?: string
  ghostscript?: string
  libreoffice?: string
  /** The bundled OCR language folder (`tessdata`, holding eng.traineddata.gz). */
  tessdata?: string
}

const isWin = process.platform === 'win32'
const exe = (name: string) => (isWin ? `${name}.exe` : name)

const NAMES: Record<ToolId, string[]> = {
  ffmpeg: [exe('ffmpeg')],
  ffprobe: [exe('ffprobe')],
  'yt-dlp': [exe('yt-dlp')],
  pandoc: [exe('pandoc')],
  // Full 7-Zip (7z + 7z.dll) can open RAR; the standalone 7za can't.
  '7zip': [exe('7z'), exe('7za'), exe('7zz')],
  deno: [exe('deno')],
  ghostscript: isWin ? ['gswin64c.exe', 'gswin32c.exe'] : ['gs'],
  libreoffice: isWin ? ['soffice.exe', 'soffice.com'] : ['soffice', 'libreoffice'],
}

const OPTIONAL = OPTIONAL_TOOLS

/** Folders where optional tools usually live when installed by the user. */
function wellKnownDirs(id: ToolId): string[] {
  if (!isWin) return []
  const pf = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean) as string[]
  if (id === 'libreoffice') return pf.map((p) => path.join(p, 'LibreOffice', 'program'))
  if (id === 'ghostscript') {
    return pf.flatMap((p) => {
      const root = path.join(p, 'gs')
      try {
        return fs
          .readdirSync(root)
          // Newest first: gs10.05 before gs9.56.
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .map((v) => path.join(root, v, 'bin'))
      } catch {
        return []
      }
    })
  }
  if (id === '7zip') return pf.map((p) => path.join(p, '7-Zip'))
  return []
}

function findIn(dirs: string[], names: string[]): string | undefined {
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name)
      try {
        if (fs.statSync(full).isFile()) return full
      } catch {
        /* keep looking */
      }
    }
  }
  return undefined
}

/**
 * Looks in Sparky's own folders first (bundled tools, then the updatable copy of yt-dlp),
 * then on PATH, then in the usual install folders.
 */
export function locateTools(dirs: string[]): Tools {
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const tools: Tools = {}
  for (const id of Object.keys(NAMES) as ToolId[]) {
    tools[id] = findIn(dirs, NAMES[id]) ?? findIn(pathDirs, NAMES[id]) ?? findIn(wellKnownDirs(id), NAMES[id])
  }
  tools.tessdata = dirs.map((d) => path.join(d, 'tessdata')).find((d) => {
    try {
      return fs.statSync(d).isDirectory()
    } catch {
      return false
    }
  })
  return tools
}

const VERSION_ARGS: Record<ToolId, string[]> = {
  ffmpeg: ['-version'],
  ffprobe: ['-version'],
  'yt-dlp': ['--version'],
  pandoc: ['--version'],
  '7zip': [],
  deno: ['--version'],
  ghostscript: ['--version'],
  libreoffice: ['--version'],
}

function pickVersion(id: ToolId, text: string): string | undefined {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  if (id === '7zip') return /7-Zip[^\d]*([\d.]+)/.exec(text)?.[1]
  if (id === 'ffmpeg' || id === 'ffprobe') return /version\s+(\S+)/.exec(first)?.[1]
  return /(\d+[\d.]*\d)/.exec(first)?.[1] ?? first.trim().slice(0, 40)
}

export async function toolStatuses(tools: Tools): Promise<ToolStatus[]> {
  const ids = Object.keys(NAMES) as ToolId[]
  return Promise.all(
    ids.map(async (id): Promise<ToolStatus> => {
      const p = tools[id]
      const base = { id, label: TOOL_LABELS[id], optional: OPTIONAL.has(id), path: p }
      if (!p) return { ...base, found: false }
      // Starting LibreOffice just to read its version is slow; its presence is enough.
      if (id === 'libreoffice') return { ...base, found: true }
      try {
        const res = await run(p, VERSION_ARGS[id], { timeoutMs: 15_000 })
        return { ...base, found: true, version: pickVersion(id, res.stdout + res.stderr) }
      } catch {
        return { ...base, found: false }
      }
    }),
  )
}

/**
 * Lists the hardware encoders FFmpeg was built with, then runs a tiny test encode with each
 * so only the ones this PC can really use are kept.
 */
export async function detectGpu(ffmpeg: string | undefined): Promise<GpuInfo & { label: string }> {
  if (!ffmpeg) return { encoders: [], label: describeGpu({ encoders: [] }) }
  try {
    const list = await run(ffmpeg, ['-hide_banner', '-encoders'], { timeoutMs: 15_000 })
    const candidates = parseEncoderList(list.stdout)
    const results = await Promise.all(
      candidates.map(async (enc) => {
        try {
          const r = await run(ffmpeg, gpuTestArgs(enc), { timeoutMs: 15_000 })
          return r.code === 0 ? enc : undefined
        } catch {
          return undefined
        }
      }),
    )
    const encoders = results.filter((e): e is string => Boolean(e))
    return { encoders, label: describeGpu({ encoders }) }
  } catch {
    return { encoders: [], label: describeGpu({ encoders: [] }) }
  }
}

/** yt-dlp runs better with a JavaScript runtime for YouTube; Deno is the one it recommends. */
export function jsRuntimeArg(tools: Tools): string | undefined {
  return tools.deno ? `deno:${tools.deno}` : undefined
}
