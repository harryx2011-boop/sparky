#!/usr/bin/env node
// Builds the CLI bundle and copies it into the desktop app's resources, so the installer ships it as
// resources\cli\lib\sparky.js, run by the resources\cli\sparky(.cmd) shims. Building every time means a
// package run can never ship a stale bundle. The bundle is built output and never committed.
//
//   node scripts/stage-cli.mjs
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const from = path.join(root, 'packages/cli/dist/sparky.js')
const to = path.join(root, 'apps/desktop/resources/cli/lib/sparky.js')

execSync('npm run build -w @sparky-labs/cli', { cwd: root, stdio: 'inherit' })
if (!fs.existsSync(from)) {
  console.error(`✗ The CLI build did not write ${path.relative(root, from)}.`)
  process.exit(1)
}
fs.copyFileSync(from, to)
console.log(`✓ Staged the CLI bundle (${(fs.statSync(to).size / 1024).toFixed(0)} KB) in ${path.relative(root, to)}`)
