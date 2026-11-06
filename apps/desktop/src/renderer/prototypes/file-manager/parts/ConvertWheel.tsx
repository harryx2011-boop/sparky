// Convert wheel for the comps: targets fly out on spokes, React Bits CircularText rims it, ClickSpark marks the pick.
import { FileIcon } from '@sparky/ui'
import { MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import CircularText from '@/components/CircularText'
import ClickSpark from '@/components/ClickSpark'
import { ENTRIES, formatSize, RECENT_TARGET, SELECTED, TARGETS } from '../data'

const SIZE = 300
const SPOKE = 98
const SPOKES = [
  ...TARGETS.video.map((ext, i) => ({ ext, angle: -150 + i * 30 })),
  ...TARGETS.audio.map((ext, i) => ({ ext, angle: 150 - i * 30 })),
]

function useLime(): string {
  const [lime, setLime] = useState('#b6f04a')
  useEffect(() => setLime(getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || lime), [lime])
  return lime
}

export function ConvertWheel({ at, picked, onPick, onClose }: { at: { x: number; y: number }; picked: string | null; onPick: (ext: string) => void; onClose: () => void }) {
  const lime = useLime()
  return (
    <MotionConfig reducedMotion="user">
      <div className="absolute inset-0 z-20" onPointerDown={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      <motion.div
        role="menu"
        aria-label="Convert to"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
        className="absolute z-30 rounded-full border border-[var(--fm-line)] bg-popover/90 shadow-2xl backdrop-blur-xl"
        style={{ left: at.x - SIZE / 2, top: at.y - SIZE / 2, width: SIZE, height: SIZE }}
      >
        <ClickSpark sparkColor={lime} sparkCount={10} sparkRadius={34} sparkSize={12} glow={0.6} duration={520}>
          <div className="absolute inset-0">
            <CircularText
              text="CONVERT TO • "
              repeat={4}
              size={SIZE}
              fontSize={9}
              fontWeight={500}
              letterSpacing={0.2}
              spinDuration={80}
              onHover="pause"
              className="font-mono text-subtle-foreground"
            />
          </div>
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
            <FileIcon ext="mp4" size={30} />
            <span className="font-mono text-[10px] text-subtle-foreground">{picked ? `mp4 → ${picked}` : `MP4 · ${formatSize(ENTRIES[SELECTED]!.size)}`}</span>
          </div>
          {SPOKES.map(({ ext, angle }, i) => {
            const rad = (angle * Math.PI) / 180
            return (
              <motion.button
                key={ext}
                type="button"
                role="menuitem"
                data-fm="spoke"
                data-recent={ext === RECENT_TARGET ? '' : undefined}
                title={ext === RECENT_TARGET ? 'Last used for mp4' : undefined}
                aria-pressed={picked === ext}
                onClick={() => onPick(ext)}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                animate={{ x: Math.cos(rad) * SPOKE, y: Math.sin(rad) * SPOKE, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 32, delay: 0.03 + i * 0.012 }}
                className="absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px] grid size-11 place-items-center rounded-full border border-[var(--fm-line)] bg-card font-mono text-[11px] text-foreground hover:border-lime hover:bg-lime hover:text-lime-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[recent]:border-lime data-[recent]:text-lime aria-pressed:bg-lime aria-pressed:text-lime-foreground"
              >
                {ext}
              </motion.button>
            )
          })}
        </ClickSpark>
      </motion.div>
    </MotionConfig>
  )
}
