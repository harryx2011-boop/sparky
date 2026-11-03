import { useId, useMemo, type CSSProperties } from 'react'
import { fileIconFor, type FileFamily } from './registry'

export interface FileIconProps {
  ext: string
  size?: number
  src?: string | null
  family?: FileFamily
  label?: string
  className?: string
  style?: CSSProperties
}

function scopeIds(svg: string, scope: string): string {
  if (!svg.includes('id="')) return svg
  return svg.replace(/id="([^"]+)"/g, `id="$1-${scope}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${scope})`).replace(/href="#([^"]+)"/g, `href="#$1-${scope}"`)
}

export function FileIcon({ ext, size = 20, src, family, label, className, style }: FileIconProps) {
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { name, svg } = fileIconFor(ext, family)
  const html = useMemo(() => scopeIds(svg.replace('<svg ', `<svg width="${size}" height="${size}" `), scope), [svg, size, scope])
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  const box: CSSProperties = { width: size, height: size, flexShrink: 0, display: 'inline-block', ...style }

  if (src) return <img src={src} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} className={className} style={{ ...box, objectFit: 'contain' }} />
  return <span {...a11y} data-file-icon={name} className={className} style={{ ...box, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
}
