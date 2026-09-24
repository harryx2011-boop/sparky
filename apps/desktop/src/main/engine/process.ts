// Spawning tools with cancel support, priority control and line-by-line output.
import { spawn, execFile } from 'node:child_process'
import os from 'node:os'

export class CanceledError extends Error {
  constructor(public readonly reason: 'cancel' | 'pause' = 'cancel') {
    super(reason === 'pause' ? 'Paused' : 'Canceled')
    this.name = 'CanceledError'
  }
}

export interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  lowPriority?: boolean
  /** Raw stdout chunks. */
  onStdout?: (chunk: string) => void
  /** Complete stdout lines (split on \n or \r). */
  onStdoutLine?: (line: string) => void
  onStderrLine?: (line: string) => void
  /** Keep at most this many characters of stderr for error messages. */
  stderrLimit?: number
  timeoutMs?: number
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

/** Kills a process and everything it started (yt-dlp.exe spawns a child on Windows). */
export function killTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => undefined)
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

function lineSplitter(onLine: (line: string) => void) {
  let buf = ''
  return {
    push(chunk: string) {
      buf += chunk
      const parts = buf.split(/\r\n|\n|\r/)
      buf = parts.pop() ?? ''
      for (const p of parts) if (p) onLine(p)
    },
    flush() {
      if (buf) onLine(buf)
      buf = ''
    },
  }
}

/** Runs a tool and resolves with its output. Rejects with CanceledError when the signal fires. */
export function run(command: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new CanceledError(opts.signal.reason === 'pause' ? 'pause' : 'cancel'))
      return
    }
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (opts.lowPriority && child.pid) {
      try {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL)
      } catch {
        /* not fatal */
      }
    }

    const limit = opts.stderrLimit ?? 64_000
    let stdout = ''
    let stderr = ''
    const out = lineSplitter((l) => opts.onStdoutLine?.(l))
    const err = lineSplitter((l) => opts.onStderrLine?.(l))
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d: string) => {
      if (stdout.length < 4_000_000) stdout += d
      opts.onStdout?.(d)
      out.push(d)
    })
    child.stderr.on('data', (d: string) => {
      stderr = (stderr + d).slice(-limit)
      err.push(d)
    })

    let canceled: CanceledError | undefined
    const onAbort = () => {
      canceled = new CanceledError(opts.signal?.reason === 'pause' ? 'pause' : 'cancel')
      killTree(child.pid)
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          stderr += `\nTimed out after ${Math.round(opts.timeoutMs! / 1000)}s`
          killTree(child.pid)
        }, opts.timeoutMs)
      : undefined

    child.on('error', (e) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (timer) clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (timer) clearTimeout(timer)
      out.flush()
      err.flush()
      if (canceled) reject(canceled)
      else resolve({ code, stdout, stderr })
    })
  })
}

/** Throws unless the process exited cleanly. */
export async function runOk(command: string, args: string[], opts: RunOptions & { explain?: (stderr: string) => string } = {}): Promise<RunResult> {
  const res = await run(command, args, opts)
  if (res.code !== 0) {
    const message = opts.explain ? opts.explain(res.stderr) : res.stderr.trim().split(/\r?\n/).pop() || `Exited with code ${res.code}`
    throw new Error(message)
  }
  return res
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CanceledError(signal.reason === 'pause' ? 'pause' : 'cancel')
}
