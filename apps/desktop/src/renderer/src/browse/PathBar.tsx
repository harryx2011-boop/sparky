// Path bar: the breadcrumb of the open folder (deep middles fold into a menu); a click on its empty part, Ctrl+L, Alt+D or F4 turns it into a typed path.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { checkTyped, crumbs, foldCrumbs, type Crumb } from './model'

const isEditKey = (e: KeyboardEvent) => e.key === 'F4' || (e.ctrlKey && e.key.toLowerCase() === 'l') || (e.altKey && e.key.toLowerCase() === 'd')

const crumbButton = 'max-w-40 truncate rounded px-1 hover:bg-accent hover:text-foreground'

export function PathBar({ path, onOpen }: { path: string; onOpen: (path: string) => void }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { head, folded, tail } = useMemo(() => foldCrumbs(crumbs(path)), [path])
  const stop = () => {
    setText(null)
    setError(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isEditKey(e)) return
      e.preventDefault()
      setText(path)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [path])

  const submit = async () => {
    if (text === null || !text.trim()) return stop()
    const res = await checkTyped(text, (p) => api.folders.list(p))
    if (!res.ok) return setError(res.message)
    stop()
    onOpen(res.path)
  }

  if (text !== null)
    return (
      <form
        className="relative min-w-0 grow"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Input
          autoFocus
          aria-label="Folder path"
          aria-invalid={error ? true : undefined}
          spellCheck={false}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Escape' && stop()}
          onBlur={stop}
          className="h-7 font-mono text-[12px] aria-[invalid]:border-destructive"
        />
        {error && (
          <p role="alert" className="absolute left-0 top-full z-10 mt-1 rounded-md border border-border bg-popover px-2 py-1 text-[12px] text-destructive shadow-sm">
            {error}
          </p>
        )}
      </form>
    )

  const last = (tail.length ? tail : head).at(-1)
  const part = (c: Crumb) =>
    c === last ? (
      <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
    ) : (
      <button type="button" title={c.path} onClick={() => onOpen(c.path)} className={crumbButton}>
        {c.label}
      </button>
    )

  return (
    <div title={path} onClick={(e) => e.target === e.currentTarget && setText(path)} className="flex h-7 min-w-0 grow cursor-text items-center overflow-hidden rounded-md px-1 hover:bg-accent/40">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-1 text-[13px] sm:gap-1">
          {head.map((c, i) => (
            <Fragment key={c.path}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">{part(c)}</BreadcrumbItem>
            </Fragment>
          ))}
          {folded.length > 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="More folders" className="rounded hover:bg-accent hover:text-foreground">
                    <BreadcrumbEllipsis className="size-6" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {folded.map((c) => (
                      <DropdownMenuItem key={c.path} onSelect={() => onOpen(c.path)}>
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
            </>
          )}
          {tail.map((c) => (
            <Fragment key={c.path}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">{part(c)}</BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
