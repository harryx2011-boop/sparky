import type { SVGProps } from 'react'
import type { Mark } from './brand-marks.generated'

export interface MarkSvgProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  mark: Mark
  size?: number
  /** Accessible name; the mark is decorative without one. */
  label?: string
}

/** One bundled brand mark, drawn inline so it paints offline. `mark.body` is our own generated markup, never user input. */
export function MarkSvg({ mark, size = 16, label, ...props }: MarkSvgProps) {
  return (
    <svg
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      viewBox={mark.viewBox}
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
      {...props}
      dangerouslySetInnerHTML={{ __html: mark.body }}
    />
  )
}
