// Turns tool output and file-system errors into sentences that say what happened and what to do.
import { OPTIONAL_TOOLS, TOOL_NAMES, type ToolStatus } from './jobs'

const DAMAGED = 'This file looks damaged, or it isn’t really what its name says. Try opening it in another app to check.'
const GONE = 'The file is gone. It may have been moved or deleted.'
const FULL = 'The drive is full. Free up some space and try again.'
const IN_USE = 'The file is open in another app. Close it and try again.'
const NO_SAVE = 'Sparky isn’t allowed to save into that folder. Pick another folder in Settings.'

export type FileAction = 'save' | 'read'

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

export function summarizeFfmpegError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const important = lines.reverse().find((l) => /error|invalid|not found|no such|unsupported|failed|could not/i.test(l))
  return important ?? lines[0] ?? ''
}

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
  canOpenRar?: boolean
  fallback?: string
}

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

export function unknownOpError(id: string): string {
  return `Sparky doesn’t have a tool called “${id}”.`
}

export function invalidOpArgsError(label: string, problems: string[]): string {
  return `${label} can’t start: ${problems.join('; ')}.`
}

const HOST_NEEDS: Record<string, string> = {
  print: 'printing to PDF',
  trash: 'the Recycle Bin',
}

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

export function secretNotKeptError(label: string): string {
  return `${label} can’t run again from History, because Sparky never keeps passwords. Start it again and enter the password.`
}

export const OUT_NEEDS_FOLDER = 'This makes more than one file, so the output has to be a folder, not a file name.'

export const OUT_FILE_BECAME_FOLDER = 'This link held more than one file, so they were saved in that file name’s folder under their own names.'

export const API_UNAUTHORIZED = 'This request needs Sparky’s API token, sent as “Authorization: Bearer <token>”. The token is in the api-token file in Sparky’s data folder.'

export function apiInvalidRequestError(problems: string[]): string {
  return problems.length ? `The request isn’t valid: ${problems.join('; ')}.` : 'The request isn’t valid JSON.'
}

export function apiRouteNotFoundError(method: string, url: string): string {
  return `Sparky’s API has no ${method} ${url}.`
}

export function jobNotFoundError(id: string): string {
  return `Sparky has no job with the id “${id}”. It may have been removed from the queue.`
}

export const API_INTERNAL = 'Something went wrong inside Sparky. Try again, and restart Sparky if it keeps happening.'

export function apiLoopbackOnlyError(host: string): string {
  return `Sparky’s API only listens on 127.0.0.1, never on “${host}”.`
}

export function apiBadPortError(value: string): string {
  return `SPARKY_API_PORT must be a whole number from 0 to 65535, not “${value}”.`
}

export const API_BAD_NONCE = 'The nonce must be 16 to 64 hexadecimal characters.'

export function configNotJsonError(file: string, server: string): string {
  return `${file} is not valid JSON, so Sparky left it alone. Fix it, or add the "${server}" server by hand.`
}

export function configNotObjectError(file: string): string {
  return `${file} does not hold a JSON object, so Sparky left it alone.`
}

export function configInlineEntryError(file: string, server: string, table: string, command: string, args: string): string {
  return `${file} already defines "${server}" inline or with dotted keys for [${table}], so Sparky left it alone. Set its command to ${command} and args to ${args} by hand.`
}

export function configInlineEnvError(file: string, table: string): string {
  return `${file} sets env inline in [${table}], so Sparky left it alone. Move those keys into an [${table}.env] table, or set Sparky's by hand.`
}

export function unknownAgentClientError(id: string, known: string[]): string {
  return `Sparky doesn’t know a client called “${id}”. It can add itself to: ${known.join(', ')}.`
}

export function agentAddedMessage(label: string): string {
  return `Added Sparky to ${label}. Restart ${label} to start using it.`
}

export function agentUpdatedMessage(label: string): string {
  return `Updated Sparky in ${label}. Restart ${label} to use the new version.`
}

export function agentAlreadyAddedMessage(label: string): string {
  return `${label} already has Sparky.`
}

export const AGENT_COMMAND_MISSING = 'This copy of Sparky doesn’t include the sparky command. Reinstall Sparky, then try again.'

export function agentAddFailedError(label: string): string {
  return `Sparky couldn’t change ${label}’s settings file. Check that it isn’t read-only or locked by another program, then try again.`
}
