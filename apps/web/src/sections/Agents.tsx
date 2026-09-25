import { Bot, SquareTerminal, Workflow, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CodeBlock } from '../components/CodeBlock'
import { Heading, Lead, Reveal } from '../components/ui'

const HTTP_CALL = [
  String.raw`$token = Get-Content "$env:APPDATA\Sparky\api-token"`,
  `$body = '{"op":"pdf.merge","args":{"files":["C:/a.pdf","C:/b.pdf"]}}'`,
  'Invoke-RestMethod -Method Post http://127.0.0.1:8600/v1/jobs `',
  '  -Headers @{ Authorization = "Bearer $token" } `',
  "  -ContentType 'application/json' -Body $body",
].join('\n')

const WAYS: { icon: LucideIcon; title: string; note: ReactNode; code: string; shell: string; label: string }[] = [
  {
    icon: Bot,
    title: 'Claude Code and other agents',
    note: 'One line gives Claude Code every Sparky tool. In the app, Settings → Agents adds Sparky to your agent with one click.',
    code: 'claude mcp add --scope user sparky -- cmd /c sparky mcp',
    shell: 'Terminal',
    label: 'the Claude Code command',
  },
  {
    icon: SquareTerminal,
    title: 'Terminal',
    note: 'The installer puts sparky on your PATH. Every tool is a command, and --json gives output a script can read.',
    code: 'sparky pdf merge a.pdf b.pdf\nsparky convert clip.mov --to mp4',
    shell: 'Terminal',
    label: 'the terminal commands',
  },
  {
    icon: Workflow,
    title: 'Any program',
    note: 'While the app is open, it takes jobs at 127.0.0.1:8600, an address only this PC can reach. Each request carries a key that only your Windows account can read.',
    code: HTTP_CALL,
    shell: 'PowerShell',
    label: 'the PowerShell example',
  },
]

export function Agents() {
  return (
    <section id="agents" className="border-t border-[#161616] px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex max-w-[680px] flex-col gap-5">
          <Heading lines={['Your agents can use it too.']} />
          <Lead>Claude Code, your scripts and any other program can run the same tools. The work happens on your PC, and your files never leave it.</Lead>
        </div>
        <ul className="flex flex-col">
          {WAYS.map((w, i) => (
            <li key={w.title} className="border-t border-border py-8 last:border-b">
              <Reveal delay={i * 0.06} y={24} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
                <div className="flex flex-col gap-2.5">
                  <h3 className="flex items-center gap-2.5 text-base font-semibold">
                    <w.icon size={18} className="shrink-0" />
                    {w.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{w.note}</p>
                </div>
                <CodeBlock code={w.code} shell={w.shell} label={w.label} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
