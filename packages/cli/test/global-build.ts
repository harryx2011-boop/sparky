// Builds dist/sparky.js once before the suites that run it.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default function setup() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' })
}
