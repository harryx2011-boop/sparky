import type { ReactNode } from 'react'

/** A laptop frame for the app mock. The screen renders its children at a fixed
 *  design viewport and scales them to the lid's width with container units, so
 *  the desktop layout never reflows on a phone. No JS. The caller owns role and
 *  label. Hardware tokens are in index.css and stay dark. */
export function DeviceLaptop({ children, viewport = [1280, 800], className }: { children: ReactNode; viewport?: [number, number]; className?: string }) {
  const [w, h] = viewport
  return (
    <div className={`mx-auto w-full ${className ?? ''}`}>
      <div className="relative mx-[5%] rounded-t-[1.25rem] bg-device px-[1.6%] pb-[1.2%] pt-[1.6%] shadow-device">
        <span aria-hidden className="absolute left-1/2 top-[0.55%] size-1.5 -translate-x-1/2 rounded-full bg-device-edge" />
        <div className="relative overflow-hidden rounded-md bg-background [container-type:inline-size]" style={{ aspectRatio: `${w} / ${h}` }}>
          {/* tan(atan2(a, b)) is the unitless a / b: the scale from the design width to the screen's. */}
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, scale: `tan(atan2(100cqw, ${w}px))` }}>
            {children}
          </div>
        </div>
      </div>
      <div aria-hidden className="relative h-3 rounded-b-[1rem] bg-gradient-to-b from-device-edge to-device-deck sm:h-4">
        <span className="absolute left-1/2 top-0 h-1.5 w-[14%] -translate-x-1/2 rounded-b-md bg-device" />
      </div>
    </div>
  )
}
