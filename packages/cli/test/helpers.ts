// Runs the built CLI the way a user does: node dist/sparky.js, with its own data folder.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CLI_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const BUNDLE = path.join(CLI_DIR, 'dist', 'sparky.js')
export const FIXTURES = path.join(CLI_DIR, '..', 'engine', 'test', 'fixtures')
export const BIN = process.env.SPARKY_TEST_BIN

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** The environment for a child CLI: its own data folder, the test tools, never the user's app on 8600. */
export function childEnv(dataDir: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, SPARKY_DATA_DIR: dataDir, ...extra }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

export function runCli(args: string[], env: NodeJS.ProcessEnv, timeoutMs = 60_000, script = BUNDLE): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`sparky ${args.join(' ')} timed out.\n${stderr}`))
    }, timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}
