// Title bar for the comps: Sparky mark, folder tabs (shadcn Tabs) and the window buttons.
import { LogoMark } from '@sparky/ui'
import { Minus, Plus, Square, X } from '../../../../components/icons/lucide';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TABS } from '../data'

export function TitleBar() {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 pl-3">
      <LogoMark size={20} />
      <Tabs defaultValue={TABS[0]} className="min-w-0">
        <TabsList className="h-8 gap-0.5 bg-transparent p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-fm="tab"
              className="group h-8 w-40 justify-between rounded-md px-3 text-[13px] font-normal text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <span className="truncate">{tab}</span>
              <X className="size-3.5 opacity-0 group-hover:opacity-60 group-data-[state=active]:opacity-60" aria-hidden />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <button type="button" aria-label="New tab" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <Plus className="size-4" />
      </button>
      <div className="ml-auto flex h-full">
        {[Minus, Square, X].map((Icon, i) => (
          <span key={i} className="grid h-full w-[46px] place-items-center text-muted-foreground hover:bg-accent">
            <Icon className={i === 1 ? 'size-3' : 'size-4'} aria-hidden />
          </span>
        ))}
      </div>
    </div>
  )
}
