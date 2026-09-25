// End-to-end conversions with the real tools.
// Point SPARKY_TEST_BIN at a folder with ffmpeg, ffprobe, pandoc, 7z/7za (and optionally yt-dlp).
// Without it, these tests are skipped.
import type { ConvertSettings, Job } from '@sparky/core'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEngine, type Engine } from '../src'
import { samePath } from '../src/output'
import { run } from '../src/process'

const BIN = process.env.SPARKY_TEST_BIN
// A skip must never pass for green in CI.
if (process.env.CI && !BIN) throw new Error('Set SPARKY_TEST_BIN in CI so the real-tool tests run.')
const has = (name: string) => Boolean(BIN && [name, `${name}.exe`].some((f) => fs.existsSync(path.join(BIN, f))))

const base: ConvertSettings = { output: 'mp4', compression: 2, resolution: null, performance: 'normal', originals: 'keep', advanced: {} }

describe.skipIf(!BIN)('engine with real tools', () => {
  let dir: string
  let engine: Engine
  const trashed: string[] = []
  const printed: string[] = []

  const waitFor = (id: string) =>
    new Promise<Job>((resolve) => {
      const check = (job: Job) => {
        if (job.id === id) {
          engine.off('finished', check)
          resolve(job)
        }
      }
      engine.on('finished', check)
    })

  const convert = async (file: string, settings: Partial<ConvertSettings>) => {
    const [job] = engine.startConvert([file], { ...base, ...settings })
    return waitFor(job!.id)
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-engine-'))
    engine = await createEngine({
      binDirs: [BIN!],
      dataDir: path.join(dir, 'data'),
      tempDir: path.join(dir, 'tmp'),
      defaultRoot: path.join(dir, 'Sparky'),
      appVersion: 'test',
      skipGpu: true,
      host: {
        trash: async (p) => {
          trashed.push(p)
          fs.rmSync(p, { recursive: true, force: true })
        },
        printToPdf: async (html, pdf) => {
          printed.push(fs.readFileSync(html, 'utf8'))
          fs.writeFileSync(pdf, '%PDF-1.4 test')
        },
      },
    })
    engine.setSettings({ batch: true, performance: 'max' })
    const ffmpeg = path.join(BIN!, 'ffmpeg')
    // A 3-second 720p test clip with a tone.
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', path.join(dir, 'clip.mov')])
    // A longer one so progress has time to be reported mid-way.
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=20', '-c:v', 'libx264', '-preset', 'ultrafast', path.join(dir, 'long.mov')])
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x480', '-frames:v', '1', path.join(dir, 'photo.png')])
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', path.join(dir, 'tone.wav')])
    fs.writeFileSync(path.join(dir, 'notes.md'), '# Hello\n\nSome **bold** text.\n\n- one\n- two\n')
  }, 120_000)

  afterAll(async () => {
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('finds the tools', async () => {
    const info = await engine.systemInfo()
    expect(info.tools.find((t) => t.id === 'ffmpeg')?.found).toBe(true)
    expect(info.tools.find((t) => t.id === 'pandoc')?.version).toMatch(/^\d/)
  })

  it('probes a video', async () => {
    const [p] = await engine.probe([path.join(dir, 'clip.mov')])
    expect(p).toMatchObject({ category: 'video', height: 720, width: 1280 })
    expect(p!.duration).toBeCloseTo(3, 0)
  })

  it('converts a video to MP4, reporting progress and sizes', async () => {
    const progress: number[] = []
    const onChange = (jobs: Job[]) => jobs.forEach((j) => j.status === 'running' && progress.push(j.progress))
    engine.on('change', onChange)
    const job = await convert(path.join(dir, 'long.mov'), { output: 'mp4', resolution: 720, performance: 'low' })
    engine.off('change', onChange)
    expect(job.status).toBe('done')
    expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'long.mp4'))
    expect(fs.statSync(job.outputs[0]!).size).toBeGreaterThan(1000)
    expect(job.sizeBefore).toBeGreaterThan(0)
    expect(progress.some((p) => p > 0 && p < 1)).toBe(true)
    // Originals are kept by default.
    expect(fs.existsSync(path.join(dir, 'long.mov'))).toBe(true)
  })

  it('scales down, never up, and names copies without clobbering', async () => {
    const job = await convert(path.join(dir, 'clip.mov'), { output: 'mp4', resolution: 1080, compression: 4 })
    const again = await convert(path.join(dir, 'clip.mov'), { output: 'mp4' })
    expect(again.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'clip (2).mp4'))
    expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'clip.mp4'))
    const [p] = await engine.probe([job.outputs[0]!])
    expect(p!.height).toBe(360) // Tiny halves the size
  })

  it('makes GIFs and pulls the sound out of video', async () => {
    const gif = await convert(path.join(dir, 'clip.mov'), { output: 'gif', compression: 4 })
    expect(gif.status).toBe('done')
    const mp3 = await convert(path.join(dir, 'clip.mov'), { output: 'mp3' })
    expect(mp3.outputs[0]).toMatch(/Audio[\\/]clip\.mp3$/)
  })

  it('converts audio', async () => {
    for (const output of ['mp3', 'flac', 'ogg', 'm4a']) {
      const job = await convert(path.join(dir, 'tone.wav'), { output })
      expect(job.status, `${output}: ${job.error}`).toBe('done')
    }
  })

  it('converts images with sharp and FFmpeg', async () => {
    const webp = await convert(path.join(dir, 'photo.png'), { output: 'webp' })
    expect(webp.status).toBe('done')
    const jpg = await convert(path.join(dir, 'photo.png'), { output: 'jpg', advanced: { width: 320 } })
    expect(jpg.status).toBe('done')
    const ico = await convert(path.join(dir, 'photo.png'), { output: 'ico' })
    expect(ico.status, ico.error).toBe('done')
    const [p] = await engine.probe([ico.outputs[0]!])
    expect(p!.width).toBeLessThanOrEqual(256)
  })

  it('shrinks in place and sends the original to the Recycle Bin', async () => {
    const copy = path.join(dir, 'replace-me.png')
    fs.copyFileSync(path.join(dir, 'photo.png'), copy)
    const job = await convert(copy, { output: 'png', originals: 'replace', compression: 4 })
    expect(job.status, job.error).toBe('done')
    // The new file is in place first; the original is set aside, then recycled.
    expect(trashed).toContain(path.join(dir, 'replace-me (original).png'))
    expect(job.outputs[0]).toBe(copy)
    expect(fs.existsSync(copy)).toBe(true)
  })

  it('keeps the new file when out names the source itself', async () => {
    const self = path.join(dir, 'self.png')
    fs.copyFileSync(path.join(dir, 'photo.png'), self)
    for (const out of [self, self.toUpperCase()]) {
      const before = trashed.length
      const [job] = await engine.runOp('convert', { files: [self], output: 'png', compression: 4, originals: 'trash', out })
      expect(job!.status, job!.error).toBe('done')
      expect(samePath(job!.outputs[0]!, self)).toBe(true)
      expect(fs.statSync(self).size).toBeGreaterThan(0)
      // Only the set-aside original may go to the Recycle Bin, never the result.
      expect(trashed.slice(before).every((p) => !samePath(p, self))).toBe(true)
    }
  })

  it('converts documents with Pandoc and prints PDFs', async () => {
    const docx = await convert(path.join(dir, 'notes.md'), { output: 'docx' })
    expect(docx.status, docx.error).toBe('done')
    const back = await convert(docx.outputs[0]!, { output: 'txt' })
    expect(fs.readFileSync(back.outputs[0]!, 'utf8')).toContain('Some bold text')
    const pdf = await convert(path.join(dir, 'notes.md'), { output: 'pdf' })
    expect(pdf.status, pdf.error).toBe('done')
    expect(printed.at(-1)).toContain('<strong>bold</strong>')
  })

  it.skipIf(!has('7za') && !has('7z'))('repacks and unpacks archives', async () => {
    const src = path.join(dir, 'bundle')
    fs.mkdirSync(path.join(src, 'inner'), { recursive: true })
    fs.writeFileSync(path.join(src, 'a.txt'), 'hello '.repeat(1000))
    fs.writeFileSync(path.join(src, 'inner', 'b.txt'), 'world')
    const zip = path.join(dir, 'bundle.zip')
    const sevenZip = path.join(BIN!, has('7z') ? '7z' : '7za')
    await run(sevenZip, ['a', '-tzip', zip, '*'], { cwd: src })
    const seven = await convert(zip, { output: '7z', compression: 4 })
    expect(seven.status, seven.error).toBe('done')
    const folder = await convert(seven.outputs[0]!, { output: 'folder' })
    expect(folder.status, folder.error).toBe('done')
    expect(fs.readFileSync(path.join(folder.outputs[0]!, 'inner', 'b.txt'), 'utf8')).toBe('world')
  })

  it('pulls the text out of a PDF', async () => {
    const pdf = path.join(dir, 'report.pdf')
    fs.copyFileSync(path.join(__dirname, 'fixtures', 'report.pdf'), pdf)
    const txt = await convert(pdf, { output: 'txt' })
    expect(txt.status, txt.error).toBe('done')
    expect(fs.readFileSync(txt.outputs[0]!, 'utf8')).toContain('Revenue went up.')
    const md = await convert(pdf, { output: 'md' })
    expect(fs.readFileSync(md.outputs[0]!, 'utf8')).toMatch(/^# report/)
  })

  it.skipIf(!has('yt-dlp'))('downloads a link and converts it in the same job', async () => {
    // yt-dlp's generic extractor handles a direct video link served locally.
    const server = http.createServer((_req, res) => {
      const file = path.join(dir, 'clip.mov')
      res.writeHead(200, { 'Content-Type': 'video/quicktime', 'Content-Length': fs.statSync(file).size })
      fs.createReadStream(file).pipe(res)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/holiday.mov`
    try {
      const info = await engine.inspect(url)
      expect(info.kind).toBe('single')
      const stages = new Set<string>()
      const onChange = (jobs: Job[]) => jobs.forEach((j) => j.stage && stages.add(j.stage.label))
      engine.on('change', onChange)
      const job = engine.startDownload({
        url,
        title: info.title,
        mode: 'video',
        quality: null,
        convertTo: 'webm',
        compression: 4,
        performance: 'normal',
        extras: { thumbnail: false, subtitles: 'off', subtitleLangs: [], metadata: false, sponsorBlock: false },
      })
      const done = await waitFor(job.id)
      engine.off('change', onChange)
      expect(done.status, done.error).toBe('done')
      expect(done.outputs[0]).toMatch(/Downloads[\\/].*\.webm$/)
      expect(fs.existsSync(done.outputs[0]!)).toBe(true)
      expect(stages).toContain('Converting')
    } finally {
      server.close()
    }
  })

  it.skipIf(!has('yt-dlp'))('explains a download that fails', async () => {
    const job = engine.startDownload({
      url: 'http://127.0.0.1:9/nothing-here',
      mode: 'audio',
      quality: null,
      compression: 2,
      performance: 'normal',
      extras: { thumbnail: false, subtitles: 'off', subtitleLangs: [], metadata: false, sponsorBlock: false },
    })
    const done = await waitFor(job.id)
    expect(done.status).toBe('failed')
    expect(done.error).toBeTruthy()
  })

  it('fails with a readable message for a broken file', async () => {
    const bad = path.join(dir, 'broken.mp4')
    fs.writeFileSync(bad, 'not a video')
    const job = await convert(bad, { output: 'webm' })
    expect(job.status).toBe('failed')
    expect(job.error).toBeTruthy()
    expect(fs.readdirSync(path.join(dir, 'Sparky', 'Video')).some((f) => f.startsWith('.sparky-'))).toBe(false)
  })

  it('cancels a running conversion and cleans up', async () => {
    const [job] = engine.startConvert([path.join(dir, 'clip.mov')], { ...base, output: 'webm', compression: 0, performance: 'low' })
    const done = waitFor(job!.id)
    await new Promise((r) => setTimeout(r, 300))
    engine.cancelJob(job!.id)
    const result = await done
    expect(result.status).toBe('canceled')
    expect(fs.readdirSync(path.join(dir, 'Sparky', 'Video')).some((f) => f.startsWith('.sparky-'))).toBe(false)
  })

  it('runs an op to the end and honours out as a file or a folder', async () => {
    const file = path.join(dir, 'custom', 'tone-out.mp3')
    const [one] = await engine.runOp('convert', { files: [path.join(dir, 'tone.wav')], output: 'mp3', out: file })
    expect(one!.status, one!.error).toBe('done')
    expect(one!.outputs).toEqual([file])
    expect(fs.statSync(file).size).toBeGreaterThan(0)

    const folder = path.join(dir, 'custom-folder')
    const both = await engine.runOp('convert', { files: [path.join(dir, 'tone.wav'), path.join(dir, 'clip.mov')], output: 'mp3', out: `${folder}${path.sep}` })
    expect(both.map((j) => j.status)).toEqual(['done', 'done'])
    for (const j of both) expect(path.dirname(j.outputs[0]!)).toBe(folder)
    expect(fs.readdirSync(folder).sort()).toEqual(['clip.mp3', 'tone.mp3'])
  })

  it('converts data documents through the document module', async () => {
    const csv = path.join(dir, 'sample.csv')
    fs.copyFileSync(path.join(__dirname, 'fixtures', 'document', 'sample.csv'), csv)
    for (const output of ['xlsx', 'pdf']) {
      const [job] = await engine.runOp('convert', { files: [csv], output })
      expect(job!.status, `${output}: ${job!.error}`).toBe('done')
      expect(path.basename(job!.outputs[0]!)).toBe(`sample.${output}`)
      expect(path.basename(path.dirname(job!.outputs[0]!))).toBe('Documents')
      expect(fs.statSync(job!.outputs[0]!).size).toBeGreaterThan(0)
    }
  })

  it('offers the targets a file can become', () => {
    const [docx] = engine.targetsFor([path.join(dir, 'notes.docx')])
    expect(docx!.targets.find((t) => t.ext === 'pdf')).toMatchObject({ op: 'convert', available: true })
    expect(engine.listOps().find((o) => o.id === 'convert')).toMatchObject({ available: true, missing: [] })
  })

  it('keeps finished jobs in history and can run them again', async () => {
    const history = engine.history({ kind: 'convert', status: 'done' })
    expect(history.length).toBeGreaterThan(5)
    const again = engine.rerun(history.find((h) => h.title.startsWith('tone.wav'))!.id)
    const job = await waitFor(again[0]!.id)
    expect(job.status).toBe('done')
  })
})
