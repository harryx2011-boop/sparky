// Folder listing and watching behind the fs:* IPC: first rows, the rest on request, plain errors, live changes.
import { existsSync } from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HEAD_ROWS, listFolder, takeRest, watchFolder } from './fs'

let dir: string
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sparky-fs-'))
})
afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true })
})

async function fill(n: number): Promise<void> {
  await Promise.all(Array.from({ length: n }, (_, i) => fsp.writeFile(path.join(dir, `f${i}.txt`), 'x')))
}

function changed(watchPath: string, act: () => Promise<void>): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setTimeout(() => {
      stop()
      reject(new Error('no change event within 1 s'))
    }, 1000)
    const stop = watchFolder(watchPath, () => {
      clearTimeout(timer)
      stop()
      resolve(Date.now() - start)
    })
    void act()
  })
}

describe('listFolder', () => {
  it('lists a small folder in one reply with sizes and kinds', async () => {
    await fsp.writeFile(path.join(dir, 'a.txt'), 'hello')
    await fsp.mkdir(path.join(dir, 'sub'))
    const result = listFolder(dir)
    if (!result.ok) throw new Error(result.message)
    expect(result.total).toBe(2)
    expect(result.rest).toBeNull()
    const i = result.head.names.indexOf('a.txt')
    expect(result.head.sizes[i]).toBe(5)
    expect(result.head.kinds[result.head.names.indexOf('sub')]).toBe(1)
  })

  it(`sends the first ${HEAD_ROWS} rows, then the rest once on request`, async () => {
    await fill(HEAD_ROWS + 250)
    const result = listFolder(dir)
    if (!result.ok) throw new Error(result.message)
    expect(result.total).toBe(HEAD_ROWS + 250)
    expect(result.head.names).toHaveLength(HEAD_ROWS)
    expect(result.head.sizes).toHaveLength(HEAD_ROWS)
    const rest = takeRest(result.rest!)
    expect(rest?.names).toHaveLength(250)
    expect(rest?.mtimes).toHaveLength(250)
    expect(new Set([...result.head.names, ...rest!.names]).size).toBe(HEAD_ROWS + 250)
    expect(takeRest(result.rest!)).toBeNull()
  })

  it("says plainly when the folder doesn't exist", () => {
    const result = listFolder(path.join(dir, 'missing'))
    expect(result).toMatchObject({ ok: false, code: 'ENOENT', message: "That folder doesn't exist." })
  })

  const blocked = 'C:\\System Volume Information'
  it.skipIf(!existsSync(blocked))('S4: Blocked folder gives a plain refused message', () => {
    const result = listFolder(blocked)
    expect(result).toMatchObject({ ok: false, code: 'EACCES', message: 'Access to this folder was refused.' })
  })
})

describe('watchFolder', () => {
  it('S3: Folder stays live: add, rename and remove each report within 1 s', async () => {
    const file = path.join(dir, 'new.txt')
    expect(await changed(dir, () => fsp.writeFile(file, 'x'))).toBeLessThan(1000)
    expect(await changed(dir, () => fsp.rename(file, path.join(dir, 'renamed.txt')))).toBeLessThan(1000)
    expect(await changed(dir, () => fsp.rm(path.join(dir, 'renamed.txt')))).toBeLessThan(1000)
  })
})
