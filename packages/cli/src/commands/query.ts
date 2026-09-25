// The commands that ask the app (or a local engine) something: ops, formats, jobs, cancel.
import { parseArgv } from '../args'
import { EXIT, UsageError } from '../errors'
import { commandName, toolLabel } from '../fields'
import { bytes } from '../report'
import { printJson, withBackend, type Command } from './types'

const FLAGS = new Set(['json', 'local', 'help'])

function flags(argv: readonly string[], command: string, positional: 'none' | 'some' = 'none') {
  const raw = parseArgv(argv, { booleans: FLAGS })
  for (const name of raw.flags.keys()) if (!FLAGS.has(name)) throw new UsageError(`Unknown option --${name} for "sparky ${command}".`)
  if (positional === 'none' && raw.positionals.length) throw new UsageError(`"sparky ${command}" takes no arguments.`)
  const on = (n: string) => raw.flags.get(n)?.at(-1) === true
  return { json: on('json'), local: on('local'), help: on('help'), positionals: raw.positionals }
}

export const opsCommand: Command = {
  name: 'ops',
  usage: 'ops',
  summary: 'List every tool, the command that runs it, and whether it can run here.',
  help: 'Usage: sparky ops [--json] [--local]\n\nLists every tool with its command and whether the programs it needs were found.',
  async run(argv, { io }) {
    const f = flags(argv, 'ops')
    if (f.help) return (io.out(this.help), EXIT.ok)
    return withBackend(f.local, io, async (b) => {
      const ops = await b.listOps()
      if (f.json) printJson(io, { ops })
      else {
        const width = Math.max(...ops.map((o) => commandName(o.id).length))
        for (const o of ops) io.out(`${commandName(o.id).padEnd(width)}  ${o.label}${o.available ? '' : `  (needs ${o.missing.map(toolLabel).join(', ')})`}`)
      }
      return EXIT.ok
    })
  },
}

export const formatsCommand: Command = {
  name: 'formats',
  usage: 'formats [files...]',
  summary: 'List the formats Sparky reads and writes, or what the given files can become.',
  help: 'Usage: sparky formats [files...] [--json] [--local]\n\nWith no files: every format by category. With files: what each one can be converted to.',
  async run(argv, { io }) {
    const f = flags(argv, 'formats', 'some')
    if (f.help) return (io.out(this.help), EXIT.ok)
    return withBackend(f.local, io, async (b) => {
      if (f.positionals.length) {
        const targets = await b.targetsFor(f.positionals)
        if (f.json) printJson(io, { targets })
        else
          for (const t of targets) {
            const opIds = [...new Set(t.targets.map((x) => x.op))]
            if (!opIds.length) io.out(`${t.path}: nothing`)
            for (const id of opIds) {
              const mine = t.targets.filter((x) => x.op === id)
              const ok = [...new Set(mine.filter((x) => x.available).map((x) => x.ext))]
              const other = mine.filter((x) => !x.available)
              const via = opIds.length > 1 ? ` (${commandName(id)})` : ''
              io.out(`${t.path}${via}: ${ok.length ? ok.join(', ') : 'nothing'}${other.length ? `; with more programs: ${other.map((x) => `${x.ext} (${x.missing.map(toolLabel).join(', ')})`).join(', ')}` : ''}`)
            }
          }
        return EXIT.ok
      }
      const info = await b.listFormats()
      if (f.json) printJson(io, info)
      else {
        const byCat = new Map<string, string[]>()
        for (const fm of info.formats) byCat.set(fm.category, [...(byCat.get(fm.category) ?? []), fm.ext])
        for (const [cat, exts] of byCat) io.out(`${cat.padEnd(9)} ${exts.join(', ')}`)
        io.out(`\nReads ${info.inputs.length} types: ${info.inputs.join(', ')}`)
      }
      return EXIT.ok
    })
  },
}

export const jobsCommand: Command = {
  name: 'jobs',
  usage: 'jobs',
  summary: "List the jobs in the open app's Queue.",
  help: "Usage: sparky jobs [--json]\n\nLists the jobs in the Sparky app's Queue. Without the app open there is no queue to list.",
  async run(argv, { io }) {
    const f = flags(argv, 'jobs')
    if (f.help) return (io.out(this.help), EXIT.ok)
    return withBackend(f.local, io, async (b) => {
      const jobs = await b.listJobs()
      if (f.json) printJson(io, { jobs })
      else if (!jobs.length) io.err(b.kind === 'local' ? 'The Sparky app is not open, so there is no queue.' : 'The queue is empty.')
      else
        for (const j of jobs) {
          const pct = j.status === 'running' && j.progress >= 0 ? ` ${Math.floor(j.progress * 100)}%` : ''
          const size = j.sizeAfter !== undefined ? ` ${bytes(j.sizeAfter)}` : ''
          io.out(`${j.id}  ${j.status}${pct}  ${j.title}${size}${j.error ? `  ${j.error}` : ''}`)
        }
      return EXIT.ok
    })
  },
}

export const cancelCommand: Command = {
  name: 'cancel',
  usage: 'cancel <id...>',
  summary: 'Cancel queued or running jobs by id.',
  help: 'Usage: sparky cancel <id...> [--json]\n\nCancels jobs in the Sparky app\'s Queue. Ids come from "sparky jobs" or --no-wait.',
  async run(argv, { io }) {
    const f = flags(argv, 'cancel', 'some')
    if (f.help) return (io.out(this.help), EXIT.ok)
    if (!f.positionals.length) throw new UsageError('"sparky cancel" needs a job id. "sparky jobs" lists them.')
    return withBackend(f.local, io, async (b) => {
      const jobs = []
      let missing = 0
      for (const id of f.positionals) {
        const job = await b.cancelJob(id)
        if (job) jobs.push(job)
        else {
          missing++
          io.err(`No job ${id}.`)
        }
      }
      if (f.json) printJson(io, { jobs })
      else for (const j of jobs) io.out(`${j.id}  ${j.status}`)
      return missing ? EXIT.usage : EXIT.ok
    })
  },
}
