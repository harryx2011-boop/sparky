// Text out of pictures with tesseract.js (WebAssembly Tesseract in a worker thread). English ships in the bundle; other languages download once into the data folder.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { CanceledError } from '../process'

export interface OcrSetup {
  /** Tesseract language code(s), e.g. "eng" or "eng+fra". */
  language: string
  /** The bundled `tessdata` folder, when there is one. */
  bundled?: string
  /** Where languages are kept, uncompressed, for tesseract.js to read. */
  cachePath: string
}

export interface OcrPage {
  text: string
  pdf?: Buffer
}

export interface OcrReader {
  read(image: Buffer, opts: { pdf: boolean; title: string }, progress: (fraction: number) => void): Promise<OcrPage>
  close(): Promise<void>
}

/** A path inside app.asar, moved to the same place in app.asar.unpacked. Either separator. */
export function unpackedPath(p: string): string {
  return p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
}

/**
 * tesseract.js starts its worker from a file inside its own package. Packaged, that package sits in
 * app.asar.unpacked (asarUnpack), because a worker thread can't start from inside the archive.
 */
function workerPath(): string | undefined {
  try {
    return unpackedPath(createRequire(import.meta.url).resolve('tesseract.js/src/worker-script/node/index.js'))
  } catch {
    return undefined
  }
}

/** Where tesseract.js itself downloads a language for its LSTM engine. */
const cdnUrl = (lang: string) => `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`

/** Written under a temporary name first, so a half-written language never looks usable. */
function writeWhole(file: string, data: Buffer): void {
  const tmp = `${file}.${process.pid}.part`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

/** A gzip file's last four bytes hold its unpacked size. */
function unpackedSize(gz: string): number {
  const fd = fs.openSync(gz, 'r')
  try {
    const tail = Buffer.alloc(4)
    fs.readSync(fd, tail, 0, 4, fs.fstatSync(fd).size - 4)
    return tail.readUInt32LE(0)
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Puts `<lang>.traineddata` in the cache before any worker starts: from the bundle when it has the language,
 * else downloaded once. tesseract.js reads the cache first, and a language it fails to load itself
 * leaves createWorker waiting forever, so every download and its failure happen here instead.
 */
async function stageLanguage(lang: string, setup: OcrSetup, signal: AbortSignal): Promise<void> {
  const cached = path.join(setup.cachePath, `${lang}.traineddata`)
  const size = fs.statSync(cached, { throwIfNoEntry: false })?.size
  const bundled = setup.bundled && path.join(setup.bundled, `${lang}.traineddata.gz`)
  if (bundled && fs.existsSync(bundled)) {
    if (size !== unpackedSize(bundled)) writeWhole(cached, gunzipSync(fs.readFileSync(bundled)))
    return
  }
  if (size) return
  let res: Response
  try {
    res = await fetch(cdnUrl(lang), { signal })
  } catch (e) {
    if (signal.aborted) throw new CanceledError(signal.reason === 'pause' ? 'pause' : 'cancel')
    throw e
  }
  if (!res.ok) throw new Error(`${lang}: the download answered ${res.status}`)
  writeWhole(cached, gunzipSync(Buffer.from(await res.arrayBuffer())))
}

/** Rejects when the signal fires, so a job never waits on a worker that was stopped. */
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const stop = () => reject(new CanceledError(signal.reason === 'pause' ? 'pause' : 'cancel'))
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  })
}

export async function openReader(setup: OcrSetup, signal: AbortSignal): Promise<OcrReader> {
  const { createWorker, OEM } = (await import('tesseract.js')).default
  fs.mkdirSync(setup.cachePath, { recursive: true })
  const langs = [...new Set(['eng', ...setup.language.split('+')])]
  for (const lang of langs) await stageLanguage(lang, setup, signal)

  let onProgress: (fraction: number) => void = () => undefined
  const script = workerPath()
  const aborted = whenAborted(signal)
  aborted.catch(() => undefined)
  // Started on English, which was just checked against the bundle: createWorker only reports failures of its first step.
  const starting = createWorker('eng', OEM.LSTM_ONLY, {
    // Everything is staged in the cache, so the language path is the cache too and nothing is fetched from here on.
    langPath: setup.cachePath,
    cachePath: setup.cachePath,
    gzip: false,
    ...(script ? { workerPath: script } : {}),
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress)
    },
    // Without a handler, a failed job also throws inside tesseract.js's message listener, which would crash the process.
    errorHandler: () => undefined,
  })
  starting.catch(() => undefined)
  const worker = await Promise.race([starting, aborted]).catch((e) => {
    void starting.then((w) => w.terminate()).catch(() => undefined)
    throw e
  })
  const stop = () => void worker.terminate()
  signal.addEventListener('abort', stop, { once: true })

  try {
    // reinitialize's promise does reject when a language fails to load, unlike createWorker's.
    if (setup.language !== 'eng') {
      const switching = worker.reinitialize(setup.language, OEM.LSTM_ONLY)
      switching.catch(() => undefined)
      await Promise.race([switching, aborted])
    }
  } catch (e) {
    signal.removeEventListener('abort', stop)
    await worker.terminate().catch(() => undefined)
    throw e
  }

  return {
    async read(image, opts, progress) {
      onProgress = progress
      const job = worker.recognize(image, { pdfTitle: opts.title }, { text: true, pdf: opts.pdf })
      job.catch(() => undefined)
      const { data } = await Promise.race([job, aborted])
      return { text: data.text, pdf: opts.pdf && data.pdf ? Buffer.from(data.pdf) : undefined }
    },
    async close() {
      signal.removeEventListener('abort', stop)
      await worker.terminate()
    },
  }
}
