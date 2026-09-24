import { cn } from '@sparky/ui'
import { ChevronRight } from 'lucide-react'
import { Accordion as A } from 'radix-ui'
import type { ReactNode } from 'react'

export function Disclosure({ title, children, className, defaultOpen }: { title: ReactNode; children: ReactNode; className?: string; defaultOpen?: boolean }) {
  return (
    <A.Root type="single" collapsible defaultValue={defaultOpen ? 'x' : undefined} className={className}>
      <A.Item value="x">
        <A.Header>
          <A.Trigger className="group flex items-center gap-1 text-xs text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight size={13} className="transition-transform group-data-[state=open]:rotate-90" />
            {title}
          </A.Trigger>
        </A.Header>
        <A.Content className={cn('overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down')}>
          <div className="pt-3">{children}</div>
        </A.Content>
      </A.Item>
    </A.Root>
  )
}
