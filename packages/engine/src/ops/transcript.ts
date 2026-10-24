// transcript: the words of a video from its captions, saved as a text file. Only the caption file is fetched.
import { explainYtDlpError, OP_TEXT, pickCaptionFile, planTranscript, TRANSCRIPT_TEXT, vttToText } from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import { saveResult } from '../image/save'
import { run, throwIfAborted } from '../process'
import { jsRuntimeArg } from '../tools'
import type { Op } from './types'

const F = TRANSCRIPT_TEXT.fields

const input = z.object({
  urls: z.array(z.string().min(1)).min(1).meta(F.urls),
  langs: z.array(z.string().min(1)).optional().meta(F.langs),
  timestamps: z.boolean().optional().meta(F.timestamps),
})

const MAX_CAPTION_BYTES = 20 * 1024 * 1024

const YTDLP_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }

export const transcriptOp: Op<typeof input> = {
  id: 'transcript',
  label: TRANSCRIPT_TEXT.label,
  doneLabel: TRANSCRIPT_TEXT.done,
  category: 'download',
  kind: 'download',
  arity: 'each',
  positional: ['urls'],
  resumable: false,
  input,
  accepts: () => false,
  requires: ['yt-dlp'],
  many: (a) => a.urls.length > 1,
  describe: (a) => ({ title: TRANSCRIPT_TEXT.title(a.urls[0] ?? ''), source: a.urls[0], category: 'download' }),
  async run(ctx, a) {
    const exe = ctx.tools['yt-dlp']
    if (!exe) throw new Error(OP_TEXT.unknown.label)
    const outputs: string[] = []
    for (const url of a.urls) {
      throwIfAborted(ctx.signal)
      ctx.progress({ fraction: null })
      const work = await fs.mkdtemp(path.join(ctx.tempDir, 'transcript-'))
      try {
        const res = await run(exe, planTranscript(url, { outputDir: work, langs: a.langs, jsRuntime: jsRuntimeArg(ctx.tools) }), { signal: ctx.signal, env: YTDLP_ENV, timeoutMs: 120_000 })
        const file = pickCaptionFile(await fs.readdir(work), a.langs ?? ['en'])
        if (!file) throw new Error(res.code === 0 ? TRANSCRIPT_TEXT.noCaptions : explainYtDlpError(res.stderr).message)
        const captions = path.join(work, file)
        if ((await fs.stat(captions)).size > MAX_CAPTION_BYTES) throw new Error(TRANSCRIPT_TEXT.tooBig)
        const text = vttToText(await fs.readFile(captions, 'utf8'), a.timestamps)
        if (!text) throw new Error(TRANSCRIPT_TEXT.noCaptions)
        const name = file.replace(/\.[^.]+\.vtt$/i, '')
        outputs.push(await saveResult(ctx, { input: path.join(work, `${name}.vtt`), ext: 'txt', category: 'download', suffix: ' (transcript)' }, (tmp) => fs.writeFile(tmp, `${text}\n`, 'utf8')))
      } finally {
        await fs.rm(work, { recursive: true, force: true }).catch(() => undefined)
      }
    }
    return { outputs }
  },
}
