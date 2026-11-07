// File icons for long lists: Windows icons and fixed-colour pack icons are cached images; text-colour pack icons sit once in a hidden sprite drawn with <use>.
import { fileIconFor } from '@sparky/ui'
import { useFileIcon } from './fileIcons'

const SVG_NS = 'http://www.w3.org/2000/svg'
const defined = new Set<string>()
let sprite: SVGSVGElement | null = null

function scoped(markup: string, scope: string): string {
  return markup
    .replace(/id="([^"]+)"/g, `id="$1-${scope}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${scope})`)
    .replace(/href="#([^"]+)"/g, `href="#$1-${scope}"`)
}

function symbolFor(ext: string): string {
  const { name, svg } = fileIconFor(ext)
  const id = `sp-file-${name}`
  if (defined.has(id)) return id
  if (!sprite) {
    sprite = document.createElementNS(SVG_NS, 'svg')
    sprite.setAttribute('aria-hidden', 'true')
    sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    document.body.prepend(sprite)
  }
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 32 32'
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  sprite.insertAdjacentHTML('beforeend', `<symbol id="${id}" viewBox="${viewBox}">${scoped(inner, id)}</symbol>`)
  defined.add(id)
  return id
}

const imageUrls = new Map<string, string | null>()

function imageFor(ext: string): string | null {
  const { name, svg } = fileIconFor(ext)
  let url = imageUrls.get(name)
  if (url === undefined) {
    url = svg.includes('currentColor') ? null : `data:image/svg+xml,${encodeURIComponent(svg)}`
    imageUrls.set(name, url)
  }
  return url
}

export function ListExtIcon({ ext, size }: { ext: string; size: number }) {
  const src = useFileIcon(ext)
  const box = { width: size, height: size, flexShrink: 0 }
  if (src === undefined) return <span aria-hidden style={{ ...box, display: 'inline-block' }} />
  const image = src ?? imageFor(ext)
  if (image) return <img src={image} width={size} height={size} alt="" aria-hidden draggable={false} style={{ ...box, objectFit: 'contain' }} />
  return (
    <svg width={size} height={size} aria-hidden style={box}>
      <use href={`#${symbolFor(ext)}`} />
    </svg>
  )
}
