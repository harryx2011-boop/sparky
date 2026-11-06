// Comp viewer: pick a mood, read its concept line, and see the main window at 1280 by 780.
import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MOODS } from './moods'
import { Window } from './Window'

const params = new URLSearchParams(location.search)
const FIRST = MOODS[0]!
const startMood = MOODS.find((m) => m.id === params.get('mood')) ?? FIRST
const startWheel = params.get('wheel') !== '0'

export function CompsApp() {
  const [moodId, setMoodId] = useState(startMood.id)
  const mood = MOODS.find((m) => m.id === moodId) ?? FIRST
  return (
    <TooltipProvider>
      <div className="flex h-full flex-col items-center gap-4 overflow-auto bg-black p-5">
        <header className="flex w-[1280px] items-center gap-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Sparky 2.0 · direction</span>
          <div className="flex gap-1">
            {MOODS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === moodId}
                onClick={() => setMoodId(m.id)}
                className="h-7 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground"
              >
                {String.fromCharCode(65 + i)} · {m.name}
              </button>
            ))}
          </div>
          <p className="ml-auto text-[13px] text-muted-foreground">{mood.concept}</p>
        </header>
        <div className="h-[780px] w-[1280px] shrink-0">
          <Window key={mood.id} mood={mood} wheelOpen={startWheel} />
        </div>
      </div>
    </TooltipProvider>
  )
}
