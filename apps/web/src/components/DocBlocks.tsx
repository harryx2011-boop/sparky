import type { Block } from '../lib/docs'

const PROSE = 'text-pretty text-base leading-relaxed text-muted-foreground'

export function DocBlocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        if ('p' in b) return <p key={i} className={PROSE}>{b.p}</p>
        if ('ul' in b)
          return (
            <ul key={i} className={`${PROSE} list-disc space-y-1.5 pl-5`}>
              {b.ul.map((li) => <li key={li}>{li}</li>)}
            </ul>
          )
        if ('ol' in b)
          return (
            <ol key={i} className={`${PROSE} list-decimal space-y-1.5 pl-5`}>
              {b.ol.map((li) => <li key={li}>{li}</li>)}
            </ol>
          )
        if ('table' in b)
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {b.table.head.map((h) => (
                      <th key={h} className="px-4 py-3 font-medium text-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.table.rows.map((row) => (
                    <tr key={row.join('|')} className="border-t border-border align-top">
                      {row.map((cell, c) => (
                        <td key={c} className={`px-4 py-3 ${c === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        if ('note' in b)
          return (
            <p key={i} className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
              {b.note}
            </p>
          )
        return (
          <pre key={i} className="overflow-x-auto rounded-xl border border-border bg-card px-4 py-3 font-mono text-[13px] text-foreground">
            {b.code}
          </pre>
        )
      })}
    </div>
  )
}
