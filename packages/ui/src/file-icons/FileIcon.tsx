import { useId, useMemo, type CSSProperties } from 'react'
import { fileIconFor, type FileFamily } from './registry'

export interface FileIconProps {
  /** An extension or a file name/path. */
  ext: string
  size?: number
  /** An image to show instead, such as the icon Windows gives the extension. */
  src?: string | null
  /** Used when the extension has no icon of its own. */
  family?: FileFamily
  /** Omit for a decorative icon beside the file name. */
  label?: string
  className?: string
  style?: CSSProperties
}

/** Several copies of one icon share gradient ids, so each copy gets its own. */
function scopeIds(svg: string, scope: string): string {
  if (!svg.includes('id="')) return svg
  return svg.replace(/id="([^"]+)"/g, `id="$1-${scope}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${scope})`).replace(/href="#([^"]+)"/g, `href="#$1-${scope}"`)
}

/** A file-type icon: `src` when given, else the vendored vscode-icons SVG inline, so it paints offline. */
export function FileIcon({ ext, size = 20, src, family, label, className, style }: FileIconProps) {
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { name, svg } = fileIconFor(ext, family)
  const html = useMemo(() => scopeIds(svg.replace('<svg ', `<svg width="${size}" height="${size}" `), scope), [svg, size, scope])
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  const box: CSSProperties = { width: size, height: size, flexShrink: 0, display: 'inline-block', ...style }

  if (src) return <img src={src} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} className={className} style={{ ...box, objectFit: 'contain' }} />
  return <span {...a11y} data-file-icon={name} className={className} style={{ ...box, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
}
