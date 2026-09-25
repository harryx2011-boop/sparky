// `sparky setup` from the built bundle: the npm case (fetch plan + a real unpacker) and the installed-app case (nothing to do).
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BUNDLE, CLI_DIR, runCli, tempDir } from './helpers'

const APP_BIN = path.join(CLI_DIR, '..', '..', 'apps', 'desktop', 'resources', 'bin')
let dir: string

/** No tool folder but the data folder: no SPARKY_BIN_DIR, no SPARKY_TEST_BIN, and no installed app under LOCALAPPDATA. */
function npmEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.SPARKY_BIN_DIR
  delete env.SPARKY_TEST_BIN
  delete env.ELECTRON_RUN_AS_NODE
  return { ...env, SPARKY_DATA_DIR: path.join(dir, 'data'), LOCALAPPDATA: path.join(dir, 'local'), APPDATA: path.join(dir, 'roaming'), ...extra }
}

beforeAll(() => {
  dir = tempDir('sparky-setup-')
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }))

describe('scripts/fetch-tools.mjs', () => {
  it.skipIf(!fs.existsSync(path.join(APP_BIN, 'ffmpeg.exe')))('still runs when started through a linked folder', async () => {
    const link = path.join(dir, 'scripts-link')
    fs.symlinkSync(path.join(CLI_DIR, '..', '..', 'scripts'), link, 'junction')
    const r = await runCli([], { ...process.env }, 60_000, path.join(link, 'fetch-tools.mjs'))
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Tools are in')
  })

  it('the bundle reports the root package version', async () => {
    const root = JSON.parse(fs.readFileSync(path.join(CLI_DIR, '..', '..', 'package.json'), 'utf8')) as { version: string }
    const r = await runCli(['--version'], npmEnv())
    expect(r.stdout.trim()).toBe(root.version)
  })
})

describe.skipIf(process.platform !== 'win32')('sparky setup', () => {
  it('--dry-run lists every tool, where it goes, and an unpacker that exists', async () => {
    const r = await runCli(['setup', '--dry-run'], npmEnv())
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    const bin = path.join(dir, 'data', 'bin')
    expect(r.stdout).toContain(`would put the tools in ${bin}`)
    for (const id of ['yt-dlp', 'ffmpeg', 'pandoc', '7zip', 'deno', 'tessdata-eng']) expect(r.stdout).toMatch(new RegExp(`${id}: would fetch from https://`))
    const unpack = /Unpacks with: (.+)/.exec(r.stdout)![1]!.trim()
    expect(fs.existsSync(unpack)).toBe(true)
    expect(fs.existsSync(bin)).toBe(false)
  })

  it('resolves 7zip-bin through require(), so it works from a copy of the bundle on NODE_PATH', async () => {
    const copy = path.join(dir, 'copy')
    fs.cpSync(path.dirname(BUNDLE), copy, { recursive: true })
    // Hide an installed 7-Zip so 7zip-bin is the only unpacker left.
    const r = await runCli(['setup', '--dry-run'], npmEnv({ NODE_PATH: path.join(CLI_DIR, '..', '..', 'node_modules'), ProgramFiles: path.join(dir, 'nowhere') }), 60_000, path.join(copy, 'sparky.js'))
    expect(r.code).toBe(0)
    const unpack = /Unpacks with: (.+)/.exec(r.stdout)![1]!.trim()
    expect(unpack).toMatch(/7zip-bin[\\/]win[\\/]x64[\\/]7za\.exe$/)
    expect(fs.existsSync(unpack)).toBe(true)
  })

  it.skipIf(!fs.existsSync(path.join(APP_BIN, 'ffmpeg.exe')))('does nothing when the app already bundles the tools, even without 7zip-bin', async () => {
    const copy = path.join(dir, 'installed')
    fs.cpSync(path.dirname(BUNDLE), copy, { recursive: true })
    // The app's node_modules as the shim's NODE_PATH sees it: the natives, and no 7zip-bin.
    const appModules = path.join(dir, 'app-modules')
    fs.mkdirSync(appModules)
    fs.symlinkSync(path.join(CLI_DIR, '..', '..', 'node_modules', 'better-sqlite3'), path.join(appModules, 'better-sqlite3'), 'junction')
    const env = npmEnv({ SPARKY_BIN_DIR: APP_BIN, NODE_PATH: appModules, ProgramFiles: path.join(dir, 'nowhere') })
    const r = await runCli(['setup'], env, 60_000, path.join(copy, 'sparky.js'))
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    expect(r.stdout).toContain(`already bundled with the Sparky app in ${APP_BIN}`)
    expect(fs.existsSync(path.join(dir, 'data', 'bin'))).toBe(false)
  })
})
