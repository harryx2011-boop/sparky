import { SITES } from '@sparky/core'
import { BRAND_MARKS, BrandMark } from '@sparky/ui'

/** Every supported site that has a real mark, in registry order. */
const ITEMS = SITES.filter((s) => BRAND_MARKS[s.id])

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className={`flex shrink-0 gap-[22px] pr-[22px] motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:gap-y-3 ${hidden ? 'motion-reduce:hidden' : ''}`} aria-hidden={hidden}>
      {ITEMS.map((s) => (
        <li key={s.id} className="flex items-center gap-[9px] whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em] text-foreground">
          <BrandMark site={s.id} size={24} />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

export function SiteStrip() {
  return (
    <div className="mx-auto mt-16 flex max-w-[1200px] flex-col gap-6 border-t border-[#161616] pt-9 md:flex-row md:items-center md:gap-[35px] lg:mt-24">
      <p className="min-w-[160px] text-sm leading-normal text-subtle-foreground">Downloads from well over a thousand sites.</p>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:[mask-image:none]">
        <div className="flex w-max animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap">
          <Row />
          <Row hidden />
        </div>
      </div>
    </div>
  )
}
