import type { SVGProps } from 'react'
import type { Mark } from './brand-marks.generated'

export interface MarkSvgProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  mark: Mark
  size?: number
  label?: string
}

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
