// The local API's bearer token: 32 random bytes as hex, in a file only this user can read. The app and `sparky serve` share it.
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const VALID = /^[0-9a-f]{64}$/

const WAIT_TRIES = 40
const WAIT_MS = 25

export function tokenPath(dataDir: string): string {
  return path.join(dataDir, 'api-token')
}

export function readToken(dataDir: string): string | undefined {
  try {
    const t = fs.readFileSync(tokenPath(dataDir), 'utf8').trim()
    return VALID.test(t) ? t : undefined
  } catch {
    return undefined
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function ensureToken(dataDir: string): string {
  const existing = readToken(dataDir)
  if (existing) return existing
  fs.mkdirSync(dataDir, { recursive: true })
  const file = tokenPath(dataDir)
  const token = randomBytes(32).toString('hex')
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, token, { mode: 0o600 })
  try {
    try {
      fs.linkSync(tmp, file)
      return token
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
    for (let i = 0; i < WAIT_TRIES; i++) {
      const theirs = readToken(dataDir)
      if (theirs) return theirs
      sleepSync(WAIT_MS)
    }
    fs.renameSync(tmp, file)
    return readToken(dataDir) ?? token
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}
