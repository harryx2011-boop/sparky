// Bundles the CLI into one file, dist/sparky.js. Native modules and the packages the app also leaves out stay outside,
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rootPkg = JSON.parse(fs.readFileSync(path.join(dir, '..', '..', 'package.json'), 'utf8'))

export const EXTERNAL = ['better-sqlite3', 'sharp', 'pdfjs-dist', 'tesseract.js', '@napi-rs/canvas', 'turndown', '7zip-bin']

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const externalRe = new RegExp(`^(?:${EXTERNAL.map(escape).join('|')})(?:/.*)?$`)

const viaRequire = {
  name: 'externals-via-require',
  setup(b) {
    b.onResolve({ filter: externalRe }, (args) =>
      args.namespace === 'sparky-external' ? { path: args.path, external: true } : { path: `${args.path}#cjs`, namespace: 'sparky-external', pluginData: args.path },
    )
    b.onLoad({ filter: /.*/, namespace: 'sparky-external' }, (args) => ({ contents: `module.exports = require(${JSON.stringify(args.pluginData)})`, loader: 'js' }))
  },
}

const banner = [
  '#!/usr/bin/env node',
  "import { createRequire as __sparkyCreateRequire } from 'node:module';",
  "import { fileURLToPath as __sparkyFileURLToPath } from 'node:url';",
  "import { dirname as __sparkyDirname } from 'node:path';",
  'const require = __sparkyCreateRequire(import.meta.url);',
  'const __filename = __sparkyFileURLToPath(import.meta.url);',
  'const __dirname = __sparkyDirname(__filename);',
].join('\n')

const outfile = path.join(dir, 'dist', 'sparky.js')
const result = await build({
  entryPoints: [path.join(dir, 'src', 'index.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  banner: { js: banner },
  define: { __SPARKY_VERSION__: JSON.stringify(rootPkg.version) },
  plugins: [viaRequire],
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
})

fs.writeFileSync(path.join(dir, 'dist', 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`)

const kb = Math.round(fs.statSync(outfile).size / 1024)
const inputs = Object.keys(result.metafile.inputs).length
console.log(`dist/sparky.js ${kb} KB from ${inputs} files`)
