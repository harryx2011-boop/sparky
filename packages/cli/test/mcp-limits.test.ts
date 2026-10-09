// What an agent may see (the tool profile) and touch (the path guard) through `sparky mcp`.
import { listOps } from '@sparky/engine'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkPaths, mcpRoots } from '../src/guard'
import { CORE_OPS, profileFrom, selectOps } from '../src/profiles'
import { tempDir } from './helpers'

const op = (over: Record<string, unknown> = {}) => ({ id: 'convert', positional: ['files'], accepts: ['pdf'], ...over }) as never

describe('tool profiles', () => {
  it('names only ops the registry has', () => {
    const ids = new Set(listOps().map((o) => o.id))
    for (const id of CORE_OPS) expect(ids, id).toContain(id)
  })

  it('core keeps exactly the core ops, all keeps every op', () => {
    const ops = listOps()
    expect(selectOps('core', ops).map((o) => o.id).sort()).toEqual([...CORE_OPS].sort())
    expect(selectOps('all', ops)).toHaveLength(ops.length)
  })

  it('reads the profile from the flag, then the environment, defaulting to core', () => {
    expect(profileFrom(undefined, {})).toBe('core')
    expect(profileFrom(undefined, { SPARKY_MCP_TOOLS: 'all' })).toBe('all')
    expect(profileFrom('core', { SPARKY_MCP_TOOLS: 'all' })).toBe('core')
    expect(() => profileFrom('everything', {})).toThrow(/core, all/)
  })
})

describe('path guard', () => {
  let root: string
  let outside: string
  beforeAll(() => {
    root = fs.realpathSync(tempDir('sparky-guard-root-'))
    outside = fs.realpathSync(tempDir('sparky-guard-out-'))
  })
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('lets inputs and a result folder inside a root through', () => {
    expect(() => checkPaths(op(), { files: [path.join(root, 'a.pdf')], out: path.join(root, 'new') + path.sep }, [root])).not.toThrow()
  })

  it('refuses an input outside every root and names the roots and the variable', () => {
    expect(() => checkPaths(op(), { files: [path.join(outside, 'a.pdf')] }, [root])).toThrow(/SPARKY_MCP_ROOTS/)
    expect(() => checkPaths(op(), { files: [path.join(outside, 'a.pdf')] }, [root])).toThrow(root)
  })

  it('refuses an out outside every root', () => {
    expect(() => checkPaths(op(), { files: [path.join(root, 'a.pdf')], out: outside }, [root])).toThrow(/outside/)
  })

  it('refuses a .. that climbs out of a root', () => {
    expect(() => checkPaths(op(), { files: [path.join(root, '..', path.basename(outside), 'a.pdf')] }, [root])).toThrow(/outside/)
  })

  it('refuses a UNC path and an extended-length path', () => {
    expect(() => checkPaths(op(), { files: ['\\\\host\\share\\a.pdf'] }, [root])).toThrow(/outside/)
    expect(() => checkPaths(op(), { files: ['\\\\?\\C:\\Windows\\a.pdf'] }, [root])).toThrow(/outside/)
  })

  it('refuses a junction inside a root that points outside it', () => {
    const link = path.join(root, 'link')
    fs.symlinkSync(outside, link, 'junction')
    expect(() => checkPaths(op(), { files: [path.join(link, 'a.pdf')] }, [root])).toThrow(/outside/)
  })

  it('does not treat download links as paths', () => {
    expect(() => checkPaths(op({ id: 'download', positional: ['urls'], accepts: [] }), { urls: ['https://example.com/v'], out: root }, [root])).not.toThrow()
  })

  it('refuses replace and trash unless allowed, and an out that is an input', () => {
    const a = path.join(root, 'a.pdf')
    expect(() => checkPaths(op(), { files: [a], originals: 'replace' }, [root])).toThrow(/SPARKY_MCP_ALLOW_REPLACE/)
    expect(() => checkPaths(op(), { files: [a], originals: 'trash' }, [root])).toThrow(/SPARKY_MCP_ALLOW_REPLACE/)
    expect(() => checkPaths(op(), { files: [a], out: a }, [root])).toThrow(/SPARKY_MCP_ALLOW_REPLACE/)
    expect(() => checkPaths(op(), { files: [a], originals: 'replace' }, [root], true)).not.toThrow()
    expect(() => checkPaths(op(), { files: [a], originals: 'keep' }, [root])).not.toThrow()
  })
})

describe('mcpRoots', () => {
  it('uses SPARKY_MCP_ROOTS when set, split on semicolons', () => {
    expect(mcpRoots({ SPARKY_MCP_ROOTS: 'D:\\;C:\\work' }, 'X:\\out', 'X:\\cwd')).toEqual([path.resolve('D:\\'), path.resolve('C:\\work')])
  })

  it('falls back to the Sparky output folder and the working folder', () => {
    expect(mcpRoots({}, 'X:\\out', 'X:\\cwd')).toEqual([path.resolve('X:\\out'), path.resolve('X:\\cwd')])
  })
})
