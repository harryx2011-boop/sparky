// Path bar for the comps: history buttons, shadcn Breadcrumb, search and the view switch.
import { ArrowLeft, ArrowRight, ArrowUp, LayoutGrid, List, PanelRight, Rows3, Search } from '../../../../components/icons/lucide';
import { Fragment } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FOLDER } from '../data'

const NAV = [
  { icon: ArrowLeft, label: 'Back', enabled: true },
  { icon: ArrowRight, label: 'Forward', enabled: false },
  { icon: ArrowUp, label: 'Up one folder', enabled: true },
]

export function PathBar({ inspector, onInspector }: { inspector: boolean; onInspector: () => void }) {
  const last = FOLDER.path.length - 1
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--fm-line)] px-2">
      <div className="flex">
        {NAV.map(({ icon: Icon, label, enabled }) => (
          <button key={label} type="button" aria-label={label} disabled={!enabled} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35">
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <Breadcrumb className="min-w-0 flex-1 rounded-md px-2 py-1 hover:bg-accent/60">
        <BreadcrumbList className="flex-nowrap text-[13px]">
          {FOLDER.path.map((part, i) => (
            <Fragment key={part}>
              <BreadcrumbItem>{i === last ? <BreadcrumbPage>{part}</BreadcrumbPage> : <BreadcrumbLink href="#">{part}</BreadcrumbLink>}</BreadcrumbItem>
              {i < last && <BreadcrumbSeparator />}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <label className="flex h-7 w-56 items-center gap-2 rounded-md border border-[var(--fm-line)] px-2 text-[13px] text-subtle-foreground">
        <Search className="size-3.5" />
        <span className="flex-1">Search uxpeak</span>
        <Kbd>Ctrl K</Kbd>
      </label>
      <ToggleGroup type="single" defaultValue="details" size="sm" aria-label="View">
        <ToggleGroupItem value="details" aria-label="Details"><Rows3 className="size-4" /></ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List"><List className="size-4" /></ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid"><LayoutGrid className="size-4" /></ToggleGroupItem>
      </ToggleGroup>
      <button type="button" aria-label="Inspector" aria-pressed={inspector} onClick={onInspector} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent aria-pressed:text-foreground">
        <PanelRight className="size-4" />
      </button>
    </div>
  )
}
