// Runs one conversion: picks the tool, writes to a temporary name, then moves the result into place.
import {
  buildFfmpegPlan,
  categoryOf,
  compressionInfo,
  createFfmpegProgressParser,
  engineFor,
  explainFfmpegError,
  explainFileError,
  explainSevenZipError,
  formatInfo,
  FFPROBE_ARGS,
  ghostscriptArgs,
  isCompressOnly,
  libreOfficeArgs,
  normalizeDocExt,
  normalizeExt,
  OP_TEXT,
  opUnavailableError,
  pandocArgs,
  parseFfprobe,
  parseSevenZipProgress,
  PRINT_CSS,
  sevenZipExtractArgs,
  sevenZipPackArgs,
  type ConvertSettings,
  type FfprobeInfo,
  type GpuInfo,
  type ProbeResult,
  type Settings,
  type VideoCodec,
} from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { RunContext } from './queue'
import { convertDocument } from './document'
import { freeName, planOutput, samePath, splitOut } from './output'
import { runGhostscript } from './pdf/ghostscript'
import { run, runOk, throwIfAborted } from './process'
import type { Tools } from './tools'

/** What the running app lends the engine. Outside the app both are missing, and the ops that need them say so before starting. */
export interface EngineHost {
  /** Renders an HTML file to PDF (Electron's printToPDF in the app). */
  printToPdf?(htmlPath: string, pdfPath: string): Promise<void>
  /** Moves a file to the Recycle Bin. */
  trash?(filePath: string): Promise<void>
}

export interface EngineEnv {
  tools: Tools
  gpu: GpuInfo
  cores: number
  settings: () => Settings
  host: EngineHost
  tempDir: string
  /** The app's data folder, for files kept between runs such as downloaded OCR languages. */
  dataDir?: string
}

function need<T>(value: T | undefined, what: string): T {
  if (!value) throw new Error(`A part of Sparky is missing (${what}). Reinstalling Sparky will fix it.`)
  return value
}

export async function probe(env: EngineEnv, file: string): Promise<FfprobeInfo | undefined> {
  if (!env.tools.ffprobe) return undefined
  try {
    const res = await run(env.tools.ffprobe, [...FFPROBE_ARGS, file], { timeoutMs: 30_000 })
    return res.code === 0 ? parseFfprobe(res.stdout) : undefined
  } catch {
    return undefined
  }
}

/** A dropped folder means the files inside it (one level, hidden files skipped). An empty folder stays as one row. */
async function expandFolders(paths: string[]): Promise<string[]> {
  const out: string[] = []
  for (const p of paths) {
    const stat = await fs.stat(p).catch(() => undefined)
    if (!stat?.isDirectory()) {
      out.push(p)
      continue
    }
    const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => [])
    const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.')).map((e) => path.join(p, e.name))
    out.push(...(files.length ? files : [p]))
  }
  return out
}

export async function probeFiles(env: EngineEnv, paths: string[]): Promise<ProbeResult[]> {
  return Promise.all(
    (await expandFolders(paths)).map(async (p) => {
      const stat = await fs.stat(p).catch(() => undefined)
      const category = categoryOf(p)
      const base: ProbeResult = { path: p, name: path.basename(p), ext: normalizeExt(p), size: stat?.size ?? 0, category }
      if (stat?.isDirectory()) return { ...base, ext: 'folder', category: undefined }
      if (category === 'video' || category === 'audio' || category === 'image') {
        const info = await probe(env, p)
        if (info) return { ...base, duration: category === 'image' ? undefined : info.duration, width: info.width, height: info.height }
      }
      return base
    }),
  )
}

export interface ConvertOutcome {
  output: string
  sizeBefore: number
  sizeAfter: number
  note?: string
}

/** Where the finished file goes, and what to do with the original afterwards. */
async function planConvertOutput(env: EngineEnv, input: string, settings: ConvertSettings, target?: string) {
  const ext = normalizeExt(settings.output)
  // The folder follows what the file becomes: sound pulled from a video goes to Audio.
  const category = formatInfo(ext)?.category ?? categoryOf(input) ?? 'document'
  const sameFormat = isCompressOnly(input, ext)
  const replace = settings.originals === 'replace'
  // Replacing in place keeps the original name; otherwise pick a free one ("clip (2).mp4").
  // The name is claimed only once the file is ready, so a batch of same-named files can't collide.
  const plan = await planOutput(env.settings, { input, ext, category, replace, suffix: sameFormat && !replace ? ' (smaller)' : '', out: target })
  return { ...plan, ext, replace, sameFormat }
}

export async function convertFile(
  env: EngineEnv,
  input: string,
  settings: ConvertSettings,
  ctx: Pick<RunContext, 'signal' | 'update'>,
  opts: { out?: string; codec?: VideoCodec } = {},
): Promise<ConvertOutcome> {
  const stat = await fs.stat(input).catch(() => undefined)
  if (!stat) throw new Error('The file is gone. It may have been moved or deleted.')
  const tools = env.tools
  const engine = engineFor(input, settings.output, { libreoffice: Boolean(tools.libreoffice) })
  if (!engine) {
    // Some pairs (old Excel to PDF) only open up once LibreOffice is installed.
    if (engineFor(input, settings.output, { libreoffice: true })) throw new Error(opUnavailableError(OP_TEXT.convert.label, ['libreoffice']))
    throw new Error(`Sparky can’t turn ${normalizeExt(input).toUpperCase()} into ${normalizeExt(settings.output).toUpperCase()}.`)
  }
  // An `out` naming the source itself is a swap in place: the original is set aside before the new file lands on its name.
  const intoSource = opts.out !== undefined && samePath(splitOut(opts.out).file, input)
  // "Replace" means the original goes; with a destination of the caller's choosing that is the Recycle Bin, not a swap in place.
  if (opts.out && !intoSource && settings.originals === 'replace') settings = { ...settings, originals: 'trash' }

  const out = await planConvertOutput(env, input, settings, opts.out)
  const inPlace = (out.replace && out.sameFormat) || intoSource
  let note: string | undefined
  const cleanup = () => fs.rm(out.tmpPath, { recursive: true, force: true }).catch(() => undefined)

  try {
    switch (engine) {
      case 'ffmpeg':
        note = await runFfmpeg(env, input, out.tmpPath, settings, ctx, opts.codec)
        break
      case 'sharp':
        await runSharp(input, out.tmpPath, settings)
        break
      case 'pandoc':
        ctx.update({ progress: -1 })
        await runOk(need(tools.pandoc, 'Pandoc'), pandocArgs(input, out.tmpPath, { title: path.parse(input).name }), { signal: ctx.signal })
        break
      case 'pdf-print':
        ctx.update({ progress: -1 })
        await printToPdf(env, input, out.tmpPath, ctx.signal)
        break
      case 'libreoffice':
        ctx.update({ progress: -1 })
        await runLibreOffice(env, input, out.tmpPath, out.ext, ctx.signal)
        break
      case 'ghostscript':
        ctx.update({ progress: -1 })
        if (!tools.ghostscript) {
          throw new Error('Shrinking PDFs needs Ghostscript. Install it from ghostscript.com and restart Sparky.')
        }
        await runGhostscript(tools.ghostscript, { args: ghostscriptArgs(input, out.tmpPath, settings.compression), secret: [] }, { signal: ctx.signal, lowPriority: settings.performance === 'low', tempDir: env.tempDir, intent: 'compress' })
        break
      case 'pdf-text':
        ctx.update({ progress: -1 })
        await pdfToText(input, out.tmpPath, out.ext === 'md')
        break
      case 'document':
        await convertDocument(input, out.tmpPath, need(normalizeDocExt(out.ext) ?? undefined, 'Documents'), {}, (pct) => ctx.update({ progress: pct / 100 }), ctx.signal)
        break
      case '7zip':
        await runArchive(env, input, out.tmpPath, out.ext, settings, ctx)
        break
    }
    throwIfAborted(ctx.signal)

    // A compressed copy that came out bigger isn't worth keeping in place of the original.
    const sizeAfter = await dirSize(out.tmpPath)
    if (out.sameFormat && inPlace && sizeAfter >= stat.size) {
      await cleanup()
      return { output: input, sizeBefore: stat.size, sizeAfter: stat.size, note: 'Already as small as it gets, so the original was kept.' }
    }

    const finalPath = await out.claimFinal()
    try {
      // Put the new file in place before touching the original, so a failure never loses both.
      if (inPlace) {
        const aside = path.join(out.dir, await freeName(out.dir, path.basename(input), normalizeExt(input), ' (original)'))
        await fs.rename(input, aside)
        try {
          await out.place(finalPath)
        } catch (e) {
          await fs.rename(aside, input).catch(() => undefined)
          throw e
        }
        note = await trashOriginal(env, aside, note)
      } else {
        await out.place(finalPath)
        if ((out.replace || settings.originals === 'trash') && !samePath(finalPath, input)) note = await trashOriginal(env, input, note)
      }
    } catch (e) {
      await out.release()
      throw (e as NodeJS.ErrnoException).code ? new Error(explainFileError(e, 'save')) : e
    }
    return { output: finalPath, sizeBefore: stat.size, sizeAfter, note }
  } catch (e) {
    await cleanup()
    throw e
  }
}

async function trashOriginal(env: EngineEnv, file: string, note: string | undefined): Promise<string | undefined> {
  try {
    if (!env.host.trash) throw new Error('No Recycle Bin here')
    await env.host.trash(file)
    return note
  } catch {
    const msg = `Couldn’t move ${path.basename(file)} to the Recycle Bin, so it was left where it is.`
    return note ? `${note} ${msg}` : msg
  }
}

/** Rename, falling back to copy + delete when the two paths are on different drives. */
async function moveFile(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
    await fs.copyFile(from, to)
    await fs.rm(from, { force: true })
  }
}

async function dirSize(p: string): Promise<number> {
  const st = await fs.stat(p)
  if (!st.isDirectory()) return st.size
  let total = 0
  for (const entry of await fs.readdir(p, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += (await fs.stat(path.join(entry.parentPath, entry.name))).size
  }
  return total
}

async function runFfmpeg(env: EngineEnv, input: string, output: string, settings: ConvertSettings, ctx: Pick<RunContext, 'signal' | 'update'>, codec?: VideoCodec): Promise<string | undefined> {
  const ffmpeg = need(env.tools.ffmpeg, 'FFmpeg')
  const info = await probe(env, input)
  const adv = settings.advanced
  const total = info?.duration ? Math.max(0.1, (adv.trimEnd ?? info.duration) - (adv.trimStart ?? 0)) : undefined

  const attempt = async (gpu: GpuInfo) => {
    const plan = buildFfmpegPlan({ input, output, settings, defaultCodec: codec ?? env.settings().codec, gpu, cores: env.cores, sourceHeight: info?.height })
    const parse = createFfmpegProgressParser(total)
    ctx.update({ progress: total ? 0 : -1, note: plan.notes[0] })
    const res = await run(ffmpeg, plan.args, {
      signal: ctx.signal,
      lowPriority: plan.lowPriority,
      onStdout: (chunk) => {
        const u = parse(chunk)
        if (u) ctx.update({ progress: u.progress, speed: u.speed, eta: u.eta })
      },
    })
    return { res, plan }
  }

  let { res, plan } = await attempt(env.gpu)
  let note = plan.notes[0]
  if (res.code !== 0 && plan.usedGpu) {
    // Some drivers refuse certain sizes or formats; the CPU always works.
    await fs.rm(output, { force: true })
    ;({ res, plan } = await attempt({ encoders: [] }))
    note = 'The graphics card couldn’t handle this one, so Sparky finished it with the processor instead.'
  }
  if (res.code !== 0) throw new Error(explainFfmpegError(res.stderr))
  return note
}

async function runSharp(input: string, output: string, settings: ConvertSettings): Promise<void> {
  const { default: sharp } = await import('sharp')
  const ext = normalizeExt(settings.output)
  const quality = settings.advanced.imageQuality ?? compressionInfo(settings.compression).imageQuality
  let img = sharp(input, { animated: false }).rotate()
  const { width, height } = settings.advanced
  if (width || height) img = img.resize({ width, height, fit: 'inside', withoutEnlargement: true })
  switch (ext) {
    case 'jpg':
      img = img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
      break
    case 'webp':
      img = img.webp({ quality })
      break
    case 'avif':
      img = img.avif({ quality: Math.max(1, quality - 15) })
      break
    case 'png':
      img = img.png({ compressionLevel: 9, palette: settings.compression >= 3, quality })
      break
    case 'tiff':
      img = img.tiff({ compression: 'lzw' })
      break
  }
  await img.toFile(output).catch((e) => {
    throw new Error(explainFfmpegError((e as Error).message))
  })
}

async function printToPdf(env: EngineEnv, input: string, output: string, signal: AbortSignal): Promise<void> {
  const work = path.join(env.tempDir, `print-${randomUUID()}`)
  await fs.mkdir(work, { recursive: true })
  try {
    let html = input
    if (normalizeExt(input) !== 'html') {
      const css = path.join(work, 'print.css')
      await fs.writeFile(css, PRINT_CSS)
      html = path.join(work, 'document.html')
      const args = pandocArgs(input, html, { title: path.parse(input).name })
      args.splice(args.indexOf('--'), 0, '--css', css)
      // Let pandoc find images that sit next to the document.
      args.splice(args.indexOf('--'), 0, '--resource-path', path.dirname(input))
      await runOk(need(env.tools.pandoc, 'Pandoc'), args, { signal })
    }
    throwIfAborted(signal)
    await need(env.host.printToPdf, 'printing')(html, output)
  } finally {
    await fs.rm(work, { recursive: true, force: true })
  }
}

async function runLibreOffice(env: EngineEnv, input: string, output: string, ext: string, signal: AbortSignal): Promise<void> {
  const work = path.join(env.tempDir, `soffice-${randomUUID()}`)
  await fs.mkdir(work, { recursive: true })
  try {
    // A private profile avoids clashing with a LibreOffice window that is already open.
    const profile = `-env:UserInstallation=${pathToFileURL(path.join(work, 'profile')).href}`
    const args = libreOfficeArgs(input, work)
    // The target extension alone is enough: LibreOffice picks the matching export filter (docx, xlsx, pdf).
    args[args.indexOf('--convert-to') + 1] = ext
    await runOk(need(env.tools.libreoffice, 'LibreOffice'), [profile, ...args], { signal, timeoutMs: 5 * 60_000 })
    await moveFile(path.join(work, `${path.parse(input).name}.${ext}`), output)
  } finally {
    await fs.rm(work, { recursive: true, force: true })
  }
}

async function pdfToText(input: string, output: string, markdown: boolean): Promise<void> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await fs.readFile(input))
  const task = pdfjs.getDocument({ data, useSystemFonts: true })
  const doc = await task.promise.catch((e) => {
    throw new Error(explainFfmpegError(`${(e as Error).name} ${(e as Error).message}`))
  })
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    let lastY: number | undefined
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5] as number
      if (lastY !== undefined && Math.abs(y - lastY) > 2) text += '\n'
      text += item.str
      if (item.hasEOL) text += '\n'
      lastY = y
    }
    pages.push(text.replace(/\n{3,}/g, '\n\n').trim())
  }
  await task.destroy()
  const title = path.parse(input).name
  const body = markdown ? `# ${title}\n\n${pages.join('\n\n---\n\n')}\n` : `${pages.join('\n\n\f\n\n')}\n`
  await fs.writeFile(output, body, 'utf8')
}

async function runArchive(env: EngineEnv, input: string, output: string, ext: string, settings: ConvertSettings, ctx: Pick<RunContext, 'signal' | 'update'>): Promise<void> {
  const sevenZip = need(env.tools['7zip'], '7-Zip')
  const unpackTo = ext === 'folder' ? output : path.join(env.tempDir, `unpack-${randomUUID()}`)
  const twoSteps = ext !== 'folder'
  const onProgress = (offset: number) => (chunk: string) => {
    const p = parseSevenZipProgress(chunk)
    if (p !== undefined) ctx.update({ progress: twoSteps ? offset + p / 2 : p })
  }
  try {
    // Only the full 7-Zip (7z.exe + 7z.dll) opens RAR; the standalone 7za and 7zz don't.
    const canOpenRar = path.parse(sevenZip).name.toLowerCase() === '7z'
    const res = await run(sevenZip, sevenZipExtractArgs(input, unpackTo), { signal: ctx.signal, onStdout: onProgress(0), lowPriority: settings.performance === 'low' })
    if (res.code !== 0) throw new Error(explainSevenZipError(res.stderr + res.stdout, normalizeExt(input), { canOpenRar, fallback: 'Sparky couldn’t open this archive.' }))
    if (twoSteps) {
      const res2 = await run(sevenZip, sevenZipPackArgs(output, settings.compression), { cwd: unpackTo, signal: ctx.signal, onStdout: onProgress(0.5), lowPriority: settings.performance === 'low' })
      if (res2.code !== 0) throw new Error(explainSevenZipError(res2.stderr + res2.stdout, ext, { canOpenRar, fallback: 'Sparky couldn’t create the new archive.' }))
    }
  } finally {
    if (twoSteps) await fs.rm(unpackTo, { recursive: true, force: true })
  }
}
