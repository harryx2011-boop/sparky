// Command lines for the document and archive tools.
import { compressionInfo, type CompressionLevel } from './levels'
import { normalizeExt } from './formats'

const PANDOC_FORMATS: Record<string, string> = {
  md: 'gfm',
  html: 'html',
  docx: 'docx',
  txt: 'plain',
}

/** Pandoc for MD / HTML / DOCX / TXT. For PDF output Sparky renders HTML and prints it. */
export function pandocArgs(input: string, output: string, opts: { to?: string; title?: string } = {}): string[] {
  const from = PANDOC_FORMATS[normalizeExt(input)] ?? 'markdown'
  const to = opts.to ?? PANDOC_FORMATS[normalizeExt(output)] ?? 'html'
  const args = ['--from', from === 'gfm' ? 'gfm' : from, '--to', to, '--output', output]
  if (to === 'html' || to === 'html5') {
    args.push('--standalone', '--embed-resources')
    args.push('--metadata', `pagetitle=${opts.title ?? 'Document'}`)
  }
  if (to === 'gfm' || to === 'plain') args.push('--wrap', 'none')
  args.push('--', input)
  return args
}

/** Small stylesheet used when turning documents into PDF, so they look tidy on paper. */
export const PRINT_CSS = `
  @page { margin: 20mm 18mm; }
  html { font: 11pt/1.55 "Segoe UI", system-ui, sans-serif; color: #111; }
  body { max-width: none; margin: 0; }
  h1, h2, h3 { line-height: 1.2; margin: 1.4em 0 .5em; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.45em; } h3 { font-size: 1.2em; }
  pre, code { font-family: Consolas, "Cascadia Mono", monospace; font-size: .92em; }
  pre { background: #f5f5f5; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; }
  table { border-collapse: collapse; } td, th { border: 1px solid #ccc; padding: 4px 8px; }
  img { max-width: 100%; }
  blockquote { margin: 0; padding-left: 12px; border-left: 3px solid #ccc; color: #444; }
`

export function libreOfficeArgs(input: string, outDir: string): string[] {
  return ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, input]
}

export function ghostscriptArgs(input: string, output: string, level: CompressionLevel): string[] {
  return [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.6',
    `-dPDFSETTINGS=${compressionInfo(level).pdfPreset}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dSAFER',
    `-sOutputFile=${output}`,
    input,
  ]
}

export function sevenZipExtractArgs(archive: string, outDir: string): string[] {
  return ['x', '-y', '-bsp1', '-bb0', `-o${outDir}`, '--', archive]
}

/** Run with the working directory set to the folder being packed. */
export function sevenZipPackArgs(output: string, level: CompressionLevel): string[] {
  const type = normalizeExt(output) === 'zip' ? 'zip' : '7z'
  return ['a', `-t${type}`, `-mx=${compressionInfo(level).archiveLevel}`, '-y', '-bsp1', '-bb0', '--', output, '*']
}

/** 7-Zip prints "  42% 3 + file" style lines when -bsp1 is set. */
export function parseSevenZipProgress(chunk: string): number | undefined {
  const matches = [...chunk.matchAll(/(\d{1,3})%/g)]
  const last = matches[matches.length - 1]
  if (!last) return undefined
  return Math.min(1, Number(last[1]) / 100)
}
