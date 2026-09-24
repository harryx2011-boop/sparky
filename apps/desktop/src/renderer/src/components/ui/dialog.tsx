import { cn } from '@sparky/ui'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from './button'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  children?: ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border bg-popover p-5 shadow-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex flex-col gap-1.5">
            <D.Title className="text-[15px] font-semibold">{title}</D.Title>
            <D.Description className="text-[13px] leading-relaxed text-muted-foreground">{description}</D.Description>
          </div>
          {children}
          <div className="flex justify-end gap-2">
            <D.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </D.Close>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
