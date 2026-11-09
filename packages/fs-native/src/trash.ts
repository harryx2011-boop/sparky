// Recycle Bin without Electron (agent files A5): trash refuses a volume with no bin, restore reads the bin's $I records.
// ponytail: trash runs one PowerShell (SHFileOperation, ~1 s); move it into list.cc as IFileOperation if that is too slow.
import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import path from 'node:path'

export interface TrashedItem {
  path: string
  /** When the Recycle Bin recorded the delete, ms since 1970; pass it to `restore`. */
  deletedAt: number
}

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$paths = [string[]]($env:SPARKY_TRASH | ConvertFrom-Json)
Add-Type -Namespace Sparky -Name Bin -MemberDefinition @'
[StructLayout(LayoutKind.Sequential)] public struct QI { public int cbSize; public long size; public long items; }
[DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int SHQueryRecycleBin(string root, ref QI info);
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct OP { public IntPtr hwnd; public uint func; public string from; public string to; public ushort flags; public bool aborted; public IntPtr map; public string title; }
[DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int SHFileOperation(ref OP op);
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool GetVolumeNameForVolumeMountPoint(string mount, System.Text.StringBuilder name, int size);
'@
function Nukes($root) {
  $sb = New-Object System.Text.StringBuilder 64
  if (-not [Sparky.Bin]::GetVolumeNameForVolumeMountPoint($root, $sb, 64)) { return $false }
  $guid = [regex]::Match($sb.ToString(), '\{[^}]+\}').Value
  $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\' + $guid
  return (Get-ItemProperty -LiteralPath $key -Name NukeOnDelete -ErrorAction SilentlyContinue).NukeOnDelete -eq 1
}
foreach ($p in $paths) {
  $root = [IO.Path]::GetPathRoot($p)
  $fixed = $false
  try { $fixed = ([IO.DriveInfo]::new($root)).DriveType -eq 'Fixed' } catch {}
  $q = New-Object Sparky.Bin+QI
  $q.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($q)
  if (-not $fixed -or [Sparky.Bin]::SHQueryRecycleBin($root, [ref]$q) -ne 0 -or (Nukes $root)) { [Console]::Error.WriteLine("NOBIN:$p"); exit 2 }
}
$op = New-Object Sparky.Bin+OP
$op.func = 3
$op.from = ($paths -join [char]0) + [char]0
$op.flags = 0x40 -bor 0x10 -bor 0x4 -bor 0x200 -bor 0x400
$hr = [Sparky.Bin]::SHFileOperation([ref]$op)
if ($hr -ne 0 -or $op.aborted) { [Console]::Error.WriteLine(("FAILED:0x{0:X}" -f $hr)); exit 3 }
`

const exists = (p: string) => {
  try {
    return lstatSync(p), true
  } catch {
    return false
  }
}

/** Sends files and folders to the Recycle Bin. Refuses the whole call, touching nothing, if any path is on a volume with no bin. */
export function trash(paths: string[]): TrashedItem[] {
  if (process.platform !== 'win32') throw new Error('The Recycle Bin is Windows only.')
  const full = paths.map((p) => {
    if (!path.isAbsolute(p)) throw new Error(`${p} is not an absolute path.`)
    return path.resolve(p)
  })
  for (const p of full) if (!p.startsWith('\\\\') && !exists(p)) throw new Error(`${p} doesn't exist.`)
  const since = Date.now() - 2000
  try {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], {
      env: { ...process.env, SPARKY_TRASH: JSON.stringify(full) },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    })
  } catch (err) {
    const msg = String((err as { stderr?: Buffer }).stderr ?? '')
    // stderr can carry PowerShell's CLIXML after our line; paths never hold < or a line break.
    const [, kind, detail] = /(NOBIN|FAILED):([^\r\n<]+)/.exec(msg) ?? []
    if (kind === 'NOBIN') throw new Error(`${detail!.trim()} is on a drive with no Recycle Bin, so it was not deleted.`)
    throw new Error(`Could not move to the Recycle Bin (${detail?.trim() ?? `exit ${(err as { status?: number }).status}`}).`)
  }
  return full.map((p) => {
    const rec = records(p).filter((r) => r.deletedAt >= since).sort((a, b) => b.deletedAt - a.deletedAt)[0]
    if (!rec) throw new Error(`${p} is gone but not in the Recycle Bin.`)
    return { path: p, deletedAt: rec.deletedAt }
  })
}

/** Moves the item deleted from `originalPath` at or after `deletedAfter` back to where it was. */
export function restore(originalPath: string, deletedAfter: number): string {
  const p = path.resolve(originalPath)
  const rec = records(p).filter((r) => r.deletedAt >= deletedAfter).sort((a, b) => a.deletedAt - b.deletedAt)[0]
  if (!rec) throw new Error(`${p} is not in the Recycle Bin.`)
  if (exists(p)) throw new Error(`${p} already exists, so the Recycle Bin copy was left there.`)
  mkdirSync(path.dirname(p), { recursive: true })
  renameSync(rec.data, p)
  unlinkSync(rec.info)
  return p
}

interface BinRecord {
  original: string
  deletedAt: number
  info: string
  data: string
}

// Each delete leaves $I<id> (version, size, FILETIME, original path) next to $R<id> (the item) in <drive>\$Recycle.Bin\<SID>.
function records(original: string): BinRecord[] {
  const bin = path.join(path.parse(original).root, '$Recycle.Bin')
  const want = original.toLowerCase()
  const out: BinRecord[] = []
  for (const sid of safeDir(bin)) {
    const dir = path.join(bin, sid)
    for (const name of safeDir(dir)) {
      if (!name.startsWith('$I')) continue
      const info = path.join(dir, name)
      const rec = parseInfo(info)
      if (rec && rec.original.toLowerCase() === want) out.push({ ...rec, info, data: path.join(dir, `$R${name.slice(2)}`) })
    }
  }
  return out
}

function safeDir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function parseInfo(file: string): { original: string; deletedAt: number } | null {
  try {
    const b = readFileSync(file)
    const version = Number(b.readBigInt64LE(0))
    const deletedAt = Number(b.readBigUInt64LE(16) / 10_000n) - 11_644_473_600_000
    const raw = version >= 2 ? b.toString('utf16le', 28, 28 + Math.max(0, b.readUInt32LE(24) - 1) * 2) : b.toString('utf16le', 24, 24 + 520)
    return { original: raw.split('\0')[0]!, deletedAt }
  } catch {
    return null
  }
}
