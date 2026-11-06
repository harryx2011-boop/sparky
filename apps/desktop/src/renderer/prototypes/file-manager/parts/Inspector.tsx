// Inspector for the comps: preview of the selected file, its details and format-aware actions.
import { ArrowLeftRight, Captions, ExternalLink, Shrink } from '../../../../components/icons/lucide';
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ENTRIES, formatSize, SELECTED, SELECTED_DETAILS } from '../data'

const preview = new URL('../assets/preview.gif', import.meta.url).href

export function Inspector({ onConvert }: { onConvert: () => void }) {
  const file = ENTRIES[SELECTED]!
  const rows: [string, string][] = [
    ['Size', formatSize(file.size)],
    ['Length', SELECTED_DETAILS.duration],
    ['Picture', SELECTED_DETAILS.dimensions],
    ['Frame rate', SELECTED_DETAILS.frameRate],
    ['Modified', file.modified],
    ['From', SELECTED_DETAILS.source],
  ]
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3">
        <div className="aspect-video overflow-hidden rounded-lg border border-[var(--fm-line)] bg-black">
          <img src={preview} alt="" className="size-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        <h3 className="line-clamp-3 text-[13px] font-medium leading-snug" data-selectable>{file.name}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-subtle-foreground">{label}</dt>
              <dd className="text-right font-mono text-[11px] text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <Separator className="bg-[var(--fm-line)]" />
        <div className="grid gap-1.5 [&_svg]:size-4">
          <Button onClick={onConvert} className="justify-start"><ArrowLeftRight /> Convert to…</Button>
          <Button variant="secondary" className="justify-start"><Shrink /> Shrink for Discord</Button>
          <Button variant="secondary" className="justify-start"><Captions /> Get transcript</Button>
          <Button variant="ghost" className="justify-start text-muted-foreground"><ExternalLink /> Open in Explorer</Button>
        </div>
      </div>
    </ScrollArea>
  )
}
