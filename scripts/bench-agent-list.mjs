#!/usr/bin/env node
// Agent files A4 bench: characters an agent reads for one folder, Sparky's sparky_files_list text versus PowerShell's
// Get-ChildItem | Format-Table. Usage: node scripts/bench-agent-list.mjs [folder] (default: your Downloads folder).
import { execFileSync } from 'node:child_process'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import os from 'node:os'
import path from 'node:path'

// The workspace packages are TypeScript with extensionless imports: find the files and compile them as Node loads them.
registerHooks({
  load(url, ctx, next) {
    if (!url.endsWith('.ts')) return next(url, ctx)
    const { source } = next(url, { ...ctx, format: 'module' })
    return { format: 'module', source: stripTypeScriptTypes(String(source), { mode: 'transform', sourceUrl: url }), shortCircuit: true }
  },
  resolve(spec, ctx, next) {
    try {
      return next(spec, ctx)
    } catch (err) {
      if (!spec.startsWith('.')) throw err
      for (const tail of ['.ts', '/index.ts']) {
        try {
          return next(spec + tail, ctx)
        } catch {}
      }
      throw err
    }
  },
})

const folder = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'Downloads'))
const { callFileTool } = await import('../packages/cli/src/mcp-files.ts')

const sparky = (input) => {
  const r = callFileTool('sparky_files_list', { path: folder, ...input }, [folder])
  if (r.isError) throw new Error(r.content[0].text)
  return r.content[0].text
}
const page = sparky({})
const all = sparky({ limit: 1_000_000 })
const ps = execFileSync('powershell', ['-NoProfile', '-Command', `Get-ChildItem -LiteralPath '${folder.replace(/'/g, "''")}' | Format-Table | Out-String`], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})

const rows = (t) => t.split('\n').length - 2
const line = (label, t, n) => `${label.padEnd(34)}${String(t.length).padStart(10)} chars  ${String(n).padStart(6)} rows  ~${Math.round(t.length / 4)} tokens`
console.log(folder)
console.log(line('sparky_files_list (default page)', page, rows(page) - (page.includes('\nmore: ') ? 1 : 0)))
console.log(line('sparky_files_list (every row)', all, rows(all)))
console.log(line('Get-ChildItem | Format-Table', ps, ps.split(/\r?\n/).filter((l) => l.trim()).length - 3))
console.log(`Sparky every row is ${(ps.length / all.length).toFixed(1)}x shorter.`)
