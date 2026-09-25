// Secret fields (PDF passwords) never come from argv: "-" reads stdin, SPARKY_<FIELD> the environment, else a hidden prompt.
import { SECRET_STDIN_TWICE, secretEnvName, secretOnCommandLineError } from '@sparky/core'
import type { OpDescriptor } from '@sparky/engine'
import { kebab } from './args'
import { EXIT, UsageError } from './errors'

export interface SecretIo {
  env: Record<string, string | undefined>
  /** stdin is a terminal a person can type into. */
  interactive: boolean
  readStdin(): Promise<string>
  /** Asks with the typed characters hidden; '' means skip. */
  prompt(label: string): Promise<string>
}

/** Replaces each secret field's "-" with stdin, fills absent ones from the environment or a prompt, and refuses literals. */
export async function resolveSecrets(op: Pick<OpDescriptor, 'secret'>, args: Record<string, unknown>, io: SecretIo, titles: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const out = { ...args }
  const fromStdin = op.secret.filter((f) => out[f] === '-')
  if (fromStdin.length > 1) throw new UsageError(SECRET_STDIN_TWICE)
  for (const field of op.secret) {
    const flag = `--${kebab(field)}`
    const v = out[field]
    if (v === '-') {
      out[field] = (await io.readStdin()).replace(/\r?\n$/, '')
      continue
    }
    if (v !== undefined) throw new UsageError(secretOnCommandLineError(flag, field))
    const env = io.env[secretEnvName(field)]
    if (env) out[field] = env
    else if (io.interactive) {
      const typed = await io.prompt(`${titles[field] ?? field} (Enter to skip): `)
      if (typed) out[field] = typed
    }
  }
  return out
}

async function readAll(stream: NodeJS.ReadStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)))
  return Buffer.concat(chunks).toString('utf8')
}

/** Reads a line from the terminal without echoing it. Ctrl+C exits 130. */
function hiddenPrompt(label: string): Promise<string> {
  const { stdin, stderr } = process
  return new Promise((resolve) => {
    stderr.write(label)
    let typed = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const done = (value: string) => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stderr.write('\n')
      resolve(value)
    }
    function onData(chunk: string) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(typed)
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          stderr.write('\n')
          process.exit(EXIT.interrupted)
        }
        if (ch === '\u007f' || ch === '\b') typed = typed.slice(0, -1)
        else if (ch >= ' ') typed += ch
      }
    }
    stdin.on('data', onData)
  })
}

export const processSecretIo: SecretIo = {
  env: process.env,
  get interactive() {
    return Boolean(process.stdin.isTTY && process.stderr.isTTY)
  },
  readStdin: () => readAll(process.stdin),
  prompt: hiddenPrompt,
}
