// How the app tells a client to start Sparky: the PATH shim when there is one, else Sparky.exe as Node with the shim's own settings.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { installedEntry } from '../../src/agents/entry'

const RES = 'C:\\Users\\Jo\\AppData\\Local\\Programs\\Sparky\\resources'
const packaged = (res: string, extra: string[] = []) => {
  const files = new Set([path.win32.join(res, '..', 'Sparky.exe'), path.win32.join(res, 'cli', 'sparky.cmd'), path.win32.join(res, 'cli', 'lib', 'sparky.js'), ...extra])
  return (p: string) => files.has(p)
}

describe('installedEntry', () => {
  it('uses cmd /c sparky mcp when sparky.cmd is on PATH', () => {
    const entry = installedEntry({ platform: 'win32', pathDirs: ['C:\\Windows', 'C:\\Tools\\sparky'], resourcesDir: RES, exists: packaged(RES, ['C:\\Tools\\sparky\\sparky.cmd']) })
    expect(entry).toEqual({ command: 'cmd', args: ['/c', 'sparky', 'mcp'] })
  })

  it('ignores quotes around a PATH entry', () => {
    const entry = installedEntry({ platform: 'win32', pathDirs: ['"C:\\Tools\\sparky"'], resourcesDir: RES, exists: packaged(RES, ['C:\\Tools\\sparky\\sparky.cmd']) })
    expect(entry?.command).toBe('cmd')
  })

  it('runs Sparky.exe as Node with the shim\'s settings when the shim is not on PATH', () => {
    const entry = installedEntry({ platform: 'win32', pathDirs: ['C:\\Windows'], resourcesDir: RES, exists: packaged(RES) })
    expect(entry).toEqual({
      command: 'C:\\Users\\Jo\\AppData\\Local\\Programs\\Sparky\\Sparky.exe',
      args: ['--require', `${RES}\\cli\\lib\\esm-resolve.cjs`, `${RES}\\cli\\lib\\sparky.js`, 'mcp'],
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: `${RES}\\app.asar.unpacked\\node_modules;${RES}\\app.asar\\node_modules`,
        SPARKY_BIN_DIR: `${RES}\\bin`,
      },
    })
  })

  it('returns null when the CLI bundle is missing', () => {
    const exists = (p: string) => p === path.win32.join(RES, '..', 'Sparky.exe')
    expect(installedEntry({ platform: 'win32', pathDirs: [], resourcesDir: RES, exists })).toBeNull()
  })

  it('returns null in the dev tree, where the shim exists but Sparky.exe does not sit beside resources', () => {
    const dev = 'D:\\sparky\\sparky\\apps\\desktop\\resources'
    const exists = (p: string) => p.startsWith(`${dev}\\cli`)
    expect(installedEntry({ platform: 'win32', pathDirs: [], resourcesDir: dev, exists })).toBeNull()
  })

  it('never goes through cmd for a path holding & ( ) ^ @ | %', () => {
    const odd = 'C:\\Users\\A&B (x) ^@|%PATH%\\AppData\\Local\\Programs\\Sparky\\resources'
    const entry = installedEntry({ platform: 'win32', pathDirs: [], resourcesDir: odd, exists: packaged(odd) })
    expect(entry?.command).toBe('C:\\Users\\A&B (x) ^@|%PATH%\\AppData\\Local\\Programs\\Sparky\\Sparky.exe')
    expect(entry?.args).toContain(`${odd}\\cli\\lib\\sparky.js`)
    expect(JSON.stringify(entry)).not.toContain('"cmd"')
  })

  it('uses the bare command off Windows', () => {
    expect(installedEntry({ platform: 'linux', pathDirs: [], resourcesDir: '/x', exists: () => false })).toEqual({ command: 'sparky', args: ['mcp'] })
  })
})
