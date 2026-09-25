// Turns tool output and file-system errors into sentences that say what happened and what to do.
import { OPTIONAL_TOOLS, TOOL_NAMES, type ToolStatus } from './jobs'

const DAMAGED = 'This file looks damaged, or it isn’t really what its name says. Try opening it in another app to check.'
const GONE = 'The file is gone. It may have been moved or deleted.'
const FULL = 'The drive is full. Free up some space and try again.'
const IN_USE = 'The file is open in another app. Close it and try again.'
const NO_SAVE = 'Sparky isn’t allowed to save into that folder. Pick another folder in Settings.'

export type FileAction = 'save' | 'read'

/** Explains a Node file-system error. Unknown errors keep their own message. */
export function explainFileError(e: unknown, action: FileAction): string {
  const err = e as { code?: string; path?: string; message?: string }
  const where = err.path ? ` (${err.path})` : ''
  switch (err.code) {
    case 'ENOENT':
    case 'ENOTDIR':
      return action === 'save' ? `Sparky can’t find the folder to save into${where}. Pick another folder in Settings.` : GONE
    case 'EACCES':
    case 'EPERM':
      return action === 'save' ? NO_SAVE : 'Sparky isn’t allowed to open this file. It may be open in another app.'
    case 'EROFS':
      return 'That drive is read-only. Pick another folder in Settings.'
    case 'EBUSY':
    case 'ETXTBSY':
    case 'ELOCKED':
      return IN_USE
    case 'ENOSPC':
      return FULL
    case 'ENAMETOOLONG':
      return 'The file name is too long for Windows. Shorten it and try again.'
    case 'EEXIST':
      return 'A file with that name appeared while Sparky was working. Try again.'
    default:
      return err.message || 'Something went wrong with the file.'
  }
}

/** Picks a useful line from FFmpeg's stderr. */
export function summarizeFfmpegError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const important = lines.reverse().find((l) => /error|invalid|not found|no such|unsupported|failed|could not/i.test(l))
  return important ?? lines[0] ?? ''
}

/** Explains FFmpeg stderr, and the messages sharp and pdf.js throw for broken files. */
export function explainFfmpegError(text: string): string {
  const line = summarizeFfmpegError(text)
  const all = text
  if (/No such file or directory|Input file is missing/i.test(all)) return GONE
  if (/Permission denied/i.test(all)) return 'Sparky isn’t allowed to open this file. It may be open in another app.'
  if (/No space left/i.test(all)) return FULL
  if (/Invalid data found|moov atom not found|EBML header|could not find codec parameters|does not contain any stream|unsupported image format|Invalid PDF|premature end|truncated|corrupt|Input buffer/i.test(all)) return DAMAGED
  if (/PasswordException|password/i.test(all)) return 'This file is password protected, so Sparky can’t open it.'
  if (/Unknown encoder|Encoder .* not found/i.test(all)) return 'This copy of Sparky can’t make that kind of file. Reinstalling Sparky should fix it.'
  if (/Decoder .* not found|Unsupported codec/i.test(all)) return 'Sparky can’t read the way this file was made. Try a different source file.'
  return line || 'The conversion stopped without saying why.'
}

export interface SevenZipErrorContext {
  /** Whether this copy of 7-Zip can open RAR files. */
  canOpenRar?: boolean
  fallback?: string
}

/** Explains 7-Zip's output, which otherwise ends in an unhelpful statistics line. */
export function explainSevenZipError(output: string, inputExt: string, ctx: SevenZipErrorContext = {}): string {
  if (/Wrong password|encrypted|password/i.test(output)) return 'This archive is password protected, and Sparky can’t open those.'
  if (/Not enough space|disk full|There is not enough space/i.test(output)) return FULL
  if (/Access is denied|Can ?not open output file/i.test(output)) return NO_SAVE
  if (/Can ?not open the file as|Can't open as archive|Is not archive|Unsupported/i.test(output)) {
    if (inputExt === 'rar' && ctx.canOpenRar !== true) return 'Sparky couldn’t open this RAR file. Install 7-Zip from 7-zip.org and restart Sparky; if it still fails, the file is damaged.'
    return DAMAGED
  }
  if (/Data Error|CRC Failed|Unexpected end|Headers Error|Unavailable data/i.test(output)) return 'This archive is damaged or incomplete. Try copying or downloading it again.'
  return ctx.fallback ?? 'Sparky couldn’t work with this archive.'
}

/** Asked for an op the engine doesn't have. */
export function unknownOpError(id: string): string {
  return `Sparky doesn’t have a tool called “${id}”.`
}

/** An op's input didn't match its schema. `problems` are "field: what's wrong" lines. */
export function invalidOpArgsError(label: string, problems: string[]): string {
  return `${label} can’t start: ${problems.join('; ')}.`
}

/** What the app itself provides, named for a person reading why an op can't run outside it. */
const HOST_NEEDS: Record<string, string> = {
  print: 'printing to PDF',
  trash: 'the Recycle Bin',
}

/** An op needs something that isn't here. `missing` holds tool ids ("libreoffice") and app capabilities ("print", "trash"). */
export function opUnavailableError(label: string, missing: string[]): string {
  const tools = missing.filter((m): m is ToolStatus['id'] => m in TOOL_NAMES)
  const addOns = tools.filter((t) => OPTIONAL_TOOLS.has(t)).map((t) => TOOL_NAMES[t])
  const bundled = tools.filter((t) => !OPTIONAL_TOOLS.has(t)).map((t) => TOOL_NAMES[t])
  const host = missing.flatMap((m) => HOST_NEEDS[m] ?? [])
  const parts: string[] = []
  if (bundled.length) parts.push(`A part of Sparky is missing (${bundled.join(', ')}). Reinstalling Sparky will fix it.`)
  if (addOns.length) parts.push(`${label} needs ${addOns.join(' and ')}. Install it and restart Sparky.`)
  if (host.length) parts.push(`${label} needs ${host.join(' and ')}, which only works while the Sparky app is open.`)
  return parts.join(' ')
}

/** Rerun of a job whose op takes a password: Sparky never keeps those, so the job has to start again from the form. */
export function secretNotKeptError(label: string): string {
  return `${label} can’t run again from History, because Sparky never keeps passwords. Start it again and enter the password.`
}

export const OUT_NEEDS_FOLDER = 'This makes more than one file, so the output has to be a folder, not a file name.'

/** A download given a file name that turned out to hold several items. */
export const OUT_FILE_BECAME_FOLDER = 'This link held more than one file, so they were saved in that file name’s folder under their own names.'

/** Local HTTP API: a request without the right bearer token. */
export const API_UNAUTHORIZED = 'This request needs Sparky’s API token, sent as “Authorization: Bearer <token>”. The token is in the api-token file in Sparky’s data folder.'

/** Local HTTP API: the body isn't JSON, or isn't the shape the route takes. `problems` are "field: what's wrong" lines. */
export function apiInvalidRequestError(problems: string[]): string {
  return problems.length ? `The request isn’t valid: ${problems.join('; ')}.` : 'The request isn’t valid JSON.'
}

/** Local HTTP API: no route at this method and path. */
export function apiRouteNotFoundError(method: string, url: string): string {
  return `Sparky’s API has no ${method} ${url}.`
}

/** Local HTTP API: a job id Sparky doesn't know, or one already removed from the queue. */
export function jobNotFoundError(id: string): string {
  return `Sparky has no job with the id “${id}”. It may have been removed from the queue.`
}

/** Local HTTP API: anything unexpected. Never carries a stack. */
export const API_INTERNAL = 'Something went wrong inside Sparky. Try again, and restart Sparky if it keeps happening.'

/** Local HTTP API: asked to listen anywhere but this PC. */
export function apiLoopbackOnlyError(host: string): string {
  return `Sparky’s API only listens on 127.0.0.1, never on “${host}”.`
}

/** Local HTTP API: SPARKY_API_PORT isn't a port number. */
export function apiBadPortError(value: string): string {
  return `SPARKY_API_PORT must be a whole number from 0 to 65535, not “${value}”.`
}

/** Local HTTP API: /v1/hello without a usable nonce. */
export const API_BAD_NONCE = 'The nonce must be 16 to 64 hexadecimal characters.'
