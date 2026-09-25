// ensureToken across processes: the app and `sparky serve` starting together must end up with one token.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureToken, readToken, tokenPath } from '../../src/token'

const TOKEN_TS = pathToFileURL(path.join(__dirname, '..', '..', 'src', 'token.ts')).href

const dirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-token-race-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

/** Runs a module snippet in a separate Node process; resolves with its stdout. `onLine` sees each line as it arrives. */
function node(code: string, env: Record<string, string>, onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code], { env: { ...process.env, ...env }, windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString()
      for (const line of d.toString().split('\n')) if (line.trim()) onLine?.(line.trim())
    })
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`))))
  })
}

describe('ensureToken across processes', () => {
  it('waits for a token another process is still writing instead of replacing it', async () => {
    const dir = tmp()
    const theirs = 'a'.repeat(64)
    // Another process has created the file and not yet written to it.
    const writer = `
      import fs from 'node:fs'
      const fd = fs.openSync(process.env.FILE, 'wx', 0o600)
      console.log('created')
      await new Promise((r) => setTimeout(r, 250))
      fs.writeSync(fd, process.env.TOKEN)
      fs.closeSync(fd)
    `
    let created!: () => void
    const ready = new Promise<void>((r) => (created = r))
    const done = node(writer, { FILE: tokenPath(dir), TOKEN: theirs }, (l) => l === 'created' && created())
    await ready
    const mine = ensureToken(dir)
    await done
    expect(mine).toBe(theirs)
    expect(readToken(dir)).toBe(theirs)
  })

  it('gives every process starting at once the same token', async () => {
    const dir = tmp()
    const at = String(Date.now() + 1500)
    const racer = `
      import { ensureToken } from ${JSON.stringify(TOKEN_TS)}
      while (Date.now() < Number(process.env.AT)) {}
      process.stdout.write(ensureToken(process.env.DIR))
    `
    const tokens = await Promise.all(Array.from({ length: 6 }, () => node(racer, { DIR: dir, AT: at })))
    expect(new Set(tokens).size).toBe(1)
    expect(tokens[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(readToken(dir)).toBe(tokens[0])
    expect(fs.readdirSync(dir)).toEqual(['api-token'])
  })
})
