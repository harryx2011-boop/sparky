// Ghostscript pdfwrite for the pdf ops that rewrite a whole file: shrink, protect, unlock, flatten.
import { PDF_TEXT } from '@sparky/core'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { run } from '../process'

export interface GsCall {
  args: string[]
  secret: string[]
}

const BASE = ['-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-dQUIET']

export interface Permissions {
  print: boolean
  copy: boolean
}

export function permissionBits(p: Permissions): number {
  let bits = ~0xf3f | 256 | 512
  if (p.print) bits |= 4 | 2048
  if (p.copy) bits |= 16
  return bits | 0
}

export interface ProtectOptions extends Permissions {
  userPassword?: string
  ownerPassword?: string
}

export function passwordToken(password: string): string {
  let hex = ''
  for (const ch of password) {
    const code = ch.codePointAt(0)!
    if (code > 0xff) throw new Error(PDF_TEXT.passwordLetters)
    hex += code.toString(16).padStart(2, '0')
  }
  return `<${hex}>`
}

const outputFile = (file: string) => `-sOutputFile=${file.replace(/%/g, '%%')}`

export function protectArgs(input: string, output: string, o: ProtectOptions): GsCall {
  const owner = o.ownerPassword ? passwordToken(o.ownerPassword) : `<${randomBytes(16).toString('hex')}>`
  return {
    args: [...BASE, '-dEncryptionR=3', '-dKeyLength=128', `-dPermissions=${permissionBits(o)}`, outputFile(output), input],
    secret: [`-dOwnerPassword=${owner}`, ...(o.userPassword ? [`-dUserPassword=${passwordToken(o.userPassword)}`] : [])],
  }
}

export function unlockArgs(input: string, output: string, password?: string): GsCall {
  return { args: [...BASE, outputFile(output), input], secret: password ? [`-dPDFPassword=${passwordToken(password)}`] : [] }
}

export function flattenArgs(input: string, output: string): GsCall {
  return { args: [...BASE, '-dPreserveAnnots=false', outputFile(output), input], secret: [] }
}

export function argFileEntry(arg: string): string | undefined {
  if (/[\r\n]/.test(arg)) return undefined
  const escaped = arg.replace(/"/g, '\\"')
  if (!/\s/.test(arg)) return escaped
  return arg.endsWith('\\') ? undefined : `"${escaped}"`
}

export function argFileText(args: string[]): string {
  return args
    .map((a) => {
      const e = argFileEntry(a)
      if (e === undefined) throw new Error(PDF_TEXT.passwordUnusable)
      return `${e} \n`
    })
    .join('')
}

export function commandLine(call: GsCall, argFile: string | undefined): string[] {
  return [...(argFile ? [`@${argFile}`] : []), ...call.args]
}

export type GsIntent = 'unlock' | 'protect' | 'compress' | 'flatten'

export function explainGhostscriptError(stderr: string, o: { intent: GsIntent; password?: boolean }): string {
  if (/password/i.test(stderr)) return o.intent !== 'unlock' ? PDF_TEXT.encrypted : o.password ? PDF_TEXT.wrongPassword : PDF_TEXT.needsPassword
  if (/Couldn.t (open|initiali[sz]e)|Unrecoverable error|not a PDF|syntaxerror|undefined in/i.test(stderr)) return PDF_TEXT.damaged
  return PDF_TEXT.ghostscriptFailed
}

const NOTHING_WRITTEN = /Couldn.t initiali[sz]e file|No pages will be processed|Password did not work|requires a password/i

export interface GsRunOptions {
  signal: AbortSignal
  tempDir: string
  lowPriority?: boolean
  intent: GsIntent
  password?: boolean
}

export async function runGhostscript(gs: string, call: GsCall, opts: GsRunOptions) {
  const text = argFileText(call.secret)
  const argFile = text ? path.join(opts.tempDir, `gs-${randomUUID()}.args`) : undefined
  try {
    if (argFile) await fs.writeFile(argFile, text, { encoding: 'utf8', mode: 0o600 })
    const res = await run(gs, commandLine(call, argFile), { signal: opts.signal, lowPriority: opts.lowPriority })
    const said = `${res.stderr}\n${res.stdout}`
    if (res.code !== 0 || NOTHING_WRITTEN.test(said)) throw new Error(explainGhostscriptError(said, opts))
    return res
  } finally {
    if (argFile) await fs.rm(argFile, { force: true }).catch(() => undefined)
  }
}
