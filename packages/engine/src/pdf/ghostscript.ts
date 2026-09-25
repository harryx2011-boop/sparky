// Ghostscript pdfwrite for the pdf ops that rewrite a whole file: shrink, protect, unlock, flatten.
// Passwords go to Ghostscript in an @argfile, never on the command line where the process list shows them, and as hex
// strings of their Latin-1 bytes: RC4 PDF passwords are bytes, and pdf.js and Acrobat read them as Latin-1, not UTF-8.
import { PDF_TEXT } from '@sparky/core'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { run } from '../process'

/** A Ghostscript run: `args` go on the command line, `secret` only into the @argfile. */
export interface GsCall {
  args: string[]
  secret: string[]
}

const BASE = ['-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-dQUIET']

export interface Permissions {
  print: boolean
  copy: boolean
}

/**
 * The PDF /P value (ISO 32000 table 22): reserved bits 7-8 and 13-32 set, bits 1-2 clear.
 * Filling forms and reading for accessibility stay allowed; printing and copying follow the choices.
 */
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

/**
 * A password as a PostScript hex string of its Latin-1 bytes, for `-dName=<hex>`: Ghostscript's -d takes one PostScript
 * token and hands device parameters the same whether they came from -d or -s. Throws, in plain words, for letters Latin-1 lacks.
 */
export function passwordToken(password: string): string {
  let hex = ''
  for (const ch of password) {
    const code = ch.codePointAt(0)!
    if (code > 0xff) throw new Error(PDF_TEXT.passwordLetters)
    hex += code.toString(16).padStart(2, '0')
  }
  return `<${hex}>`
}

/** Ghostscript reads % in an output name as a page-number pattern; %% is a plain %. */
const outputFile = (file: string) => `-sOutputFile=${file.replace(/%/g, '%%')}`

/** Without an owner password a random one is set, so the print and copy limits can't be lifted with the opening password. */
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

/** Draws annotations and form fields into the page so nothing stays editable. */
export function flattenArgs(input: string, output: string): GsCall {
  return { args: [...BASE, '-dPreserveAnnots=false', outputFile(output), input], secret: [] }
}

/**
 * One argument as Ghostscript's @file reader (gsargs.c arg_next) reads it back: `\"` is a literal quote, a `\` before
 * anything else is literal, and whitespace needs the argument wrapped in quotes. Undefined for the two things that
 * reader can't carry: a line break, and whitespace together with a trailing backslash.
 */
export function argFileEntry(arg: string): string | undefined {
  if (/[\r\n]/.test(arg)) return undefined
  const escaped = arg.replace(/"/g, '\\"')
  if (!/\s/.test(arg)) return escaped
  return arg.endsWith('\\') ? undefined : `"${escaped}"`
}

/** The @argfile body. A space before each line break keeps a trailing backslash from joining two lines. Throws, in plain words, for an argument the file can't carry. */
export function argFileText(args: string[]): string {
  return args
    .map((a) => {
      const e = argFileEntry(a)
      if (e === undefined) throw new Error(PDF_TEXT.passwordUnusable)
      return `${e} \n`
    })
    .join('')
}

/** The command line for a call: the secret args only behind `@<file>`, never as they are. */
export function commandLine(call: GsCall, argFile: string | undefined): string[] {
  return [...(argFile ? [`@${argFile}`] : []), ...call.args]
}

export type GsIntent = 'unlock' | 'protect' | 'compress' | 'flatten'

/** Ghostscript's stderr as a sentence. A password complaint means a wrong or missing password only when unlocking; otherwise the PDF is locked. */
export function explainGhostscriptError(stderr: string, o: { intent: GsIntent; password?: boolean }): string {
  if (/password/i.test(stderr)) return o.intent !== 'unlock' ? PDF_TEXT.encrypted : o.password ? PDF_TEXT.wrongPassword : PDF_TEXT.needsPassword
  if (/Couldn.t (open|initiali[sz]e)|Unrecoverable error|not a PDF|syntaxerror|undefined in/i.test(stderr)) return PDF_TEXT.damaged
  return PDF_TEXT.ghostscriptFailed
}

/** What Ghostscript prints when it produced nothing from the input, even with exit code 0. */
const NOTHING_WRITTEN = /Couldn.t initiali[sz]e file|No pages will be processed|Password did not work|requires a password/i

export interface GsRunOptions {
  signal: AbortSignal
  /** Where the @argfile is written; it is deleted when the run ends. */
  tempDir: string
  lowPriority?: boolean
  intent: GsIntent
  /** A password was given (unlock). */
  password?: boolean
}

export async function runGhostscript(gs: string, call: GsCall, opts: GsRunOptions) {
  const text = argFileText(call.secret)
  const argFile = text ? path.join(opts.tempDir, `gs-${randomUUID()}.args`) : undefined
  try {
    if (argFile) await fs.writeFile(argFile, text, { encoding: 'utf8', mode: 0o600 })
    const res = await run(gs, commandLine(call, argFile), { signal: opts.signal, lowPriority: opts.lowPriority })
    const said = `${res.stderr}\n${res.stdout}`
    // Ghostscript 10 exits 0 when it can't open the input (a wrong password included) and writes an empty PDF.
    if (res.code !== 0 || NOTHING_WRITTEN.test(said)) throw new Error(explainGhostscriptError(said, opts))
    return res
  } finally {
    if (argFile) await fs.rm(argFile, { force: true }).catch(() => undefined)
  }
}
