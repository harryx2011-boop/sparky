import { FileText, Image, Video, Wrench, type LucideIcon } from 'lucide-react'
import { Heading, Lead, Reveal } from '../components/ui'
import ops from '../data/ops.json'

// ops.json comes from the real registry (scripts/gen-site-ops.mjs). A category missing here lands in "More".
const GROUPS: { category: string; label: string; icon: LucideIcon }[] = [
  { category: 'pdf', label: 'PDF', icon: FileText },
  { category: 'video', label: 'Video and audio', icon: Video },
  { category: 'image', label: 'Images', icon: Image },
  { category: 'tool', label: 'More', icon: Wrench },
]
const SHOWN_ELSEWHERE = new Set(['convert', 'download'])
const MORE = GROUPS[GROUPS.length - 1]!

const grouped = GROUPS.map((g) => ({
  ...g,
  ops: ops.filter((op) => !SHOWN_ELSEWHERE.has(op.category) && (GROUPS.find((x) => x.category === op.category) ?? MORE) === g),
})).filter((g) => g.ops.length > 0)

export function Tools() {
  return (
    <section id="tools" className="border-t border-[#161616] px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex max-w-[680px] flex-col gap-5">
          <Heading lines={['More than converting.']} />
          <Lead>
            Merge and split PDFs, trim and shrink videos, make icons and GIFs, and pull the text out of a scan. Open them from Tools in
            the app, or run them from the terminal.
          </Lead>
        </div>
        <Reveal>
          <ul className="flex flex-col">
            {grouped.map((g) => (
              <li key={g.category} className="grid grid-cols-1 gap-4 border-t border-border py-6 last:border-b md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
                <span className="flex items-center gap-3 self-start text-foreground md:pt-0.5">
                  <g.icon size={16} className="shrink-0" />
                  <span className="font-mono text-xs uppercase tracking-wider">{g.label}</span>
                </span>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.ops.map((op) => (
                    <li key={op.id} className="text-[15px] leading-snug text-muted-foreground">
                      {op.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
