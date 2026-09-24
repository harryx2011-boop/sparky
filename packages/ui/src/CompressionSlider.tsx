import { ARCHIVE_COMPRESSION_LABELS, COMPRESSION_LEVELS, compressionInfo, type CompressionLevel } from '@sparky/core'
import { Slider } from 'radix-ui'
import { useId } from 'react'
import { cn } from './cn'

export interface CompressionSliderProps {
  value: CompressionLevel
  onChange: (value: CompressionLevel) => void
  /** Archives are lossless, so their stops read as speed vs. size. */
  variant?: 'media' | 'archive'
  disabled?: boolean
  /** Shown on the right of the label row. Defaults to the level's plain hint. */
  detail?: string
  showStops?: boolean
  label?: string
  className?: string
}

export function CompressionSlider({
  value,
  onChange,
  variant = 'media',
  disabled,
  detail,
  showStops = true,
  label = 'Compression',
  className,
}: CompressionSliderProps) {
  const id = useId()
  const labels = variant === 'archive' ? ARCHIVE_COMPRESSION_LABELS : COMPRESSION_LEVELS.map((l) => l.label)
  const current = labels[value]
  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-50', className)}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <label id={id} className="font-medium">
          {label}
        </label>
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {current}
          {' · '}
          {detail ?? (variant === 'archive' ? 'Nothing is lost, only speed vs. size' : compressionInfo(value).hint)}
        </span>
      </div>
      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        min={0}
        max={4}
        step={1}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange((v[0] ?? 2) as CompressionLevel)}
        aria-labelledby={id}
      >
        <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-track">
          <Slider.Range className="absolute h-full rounded-full bg-foreground" />
        </Slider.Track>
        <Slider.Thumb
          className="block size-4 rounded-full border border-foreground bg-background shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 enabled:hover:scale-110 data-[disabled]:cursor-not-allowed"
          aria-valuetext={current}
        />
      </Slider.Root>
      {showStops && (
        <div className="grid grid-cols-5 font-mono text-[11px] text-subtle-foreground">
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => onChange(i as CompressionLevel)}
              className={cn(
                'truncate transition-colors hover:text-foreground disabled:pointer-events-none',
                i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center',
                i === value && 'text-foreground',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
