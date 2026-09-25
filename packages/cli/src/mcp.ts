// `sparky mcp`: the MCP server over stdio. One tool per op in the registry, plus list, job and cancel tools.
// stdout belongs to the transport; everything else goes to stderr.
import type { Job } from '@sparky/core'
import { listOps, type OpDescriptor } from '@sparky/engine'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js'
import type { JsonSchema, ObjectSchema } from './args'
import { connectRemote, LocalBackend, type Backend } from './backend'
import { cliPaths, localForced, VERSION } from './env'
import { BackendError, messageOf } from './errors'
import { acceptsText, choiceText, fieldsOf, OUT_TEXT, toolLabel, toolName } from './fields'
import { headline, summarize } from './report'

const JOB_SHAPE = '{ jobs: [{ id, status, outputs, error, note, sizeBefore, sizeAfter }] }'

const WAIT_FIELD: JsonSchema = {
  type: 'boolean',
  default: true,
  description: 'true (default): wait until the job finishes and return its output paths. false: return the job ids at once; the job keeps running in Sparky, and sparky_get_job reports it.',
}

/** The op's input schema for an agent: labels folded into descriptions, `out` described, `wait` added. */
export function toolInputSchema(op: OpDescriptor): Tool['inputSchema'] {
  const schema = op.inputSchema as ObjectSchema & Record<string, unknown>
  const properties: Record<string, JsonSchema> = {}
  for (const f of fieldsOf(op)) {
    const { labels: _labels, ...s } = f.schema
    const parts = [f.description ?? (f.schema.title ? undefined : f.title)].filter(Boolean) as string[]
    const choices = f.labels ? choiceText(f) : undefined
    if (choices) parts.push(`Choices: ${choices}.`)
    if (f.secret) parts.push('Used for this job only; never stored or echoed back.')
    if (f.positional && f.schema.type === 'array') parts.push('Absolute local paths work best.')
    properties[f.name] = { ...s, ...(f.name === 'out' && !s.title ? { title: OUT_TEXT.title } : {}), ...(parts.length ? { description: parts.join(' ') } : {}) }
  }
  properties.wait = WAIT_FIELD
  return { ...schema, type: 'object', properties, ...(schema.required ? { required: schema.required } : {}) } as Tool['inputSchema']
}

/** What an agent reads to pick the tool: what it does, what it takes, what it needs, what it returns. */
export function toolDescription(op: OpDescriptor): string {
  const fields = fieldsOf(op)
  const first = fields.find((f) => f.positional)
  const list = first?.name ?? 'inputs'
  const parts = [`${op.label}, with Sparky on this computer. Use it when the user asks for this: "${op.label}".`]
  parts.push(op.accepts.length ? `Takes local files (${acceptsText(op)}) by path in \`${list}\`; nothing is uploaded.` : `Takes ${acceptsText(op)} in \`${list}\`.`)
  parts.push(op.arity === 'all' ? `Everything in \`${list}\` goes into one job with one result.` : `Each item in \`${list}\` becomes its own job, so one call can take many.`)
  const target = fields.find((f) => f.name === 'output' && f.required && !f.choices)
  if (target) parts.push('Set `output` to the target extension; sparky_list_formats with `paths` lists what each file can become.')
  if (op.requires.length) parts.push(`Needs ${op.requires.map(toolLabel).join(' and ')}; sparky_list_ops shows whether it was found.`)
  const opts = fields.filter((f) => !f.positional && f.name !== 'out').map((f) => (f.schema.title ? `${f.name} (${f.title})` : f.name))
  if (opts.length) parts.push(`Options: ${opts.join(', ')}.`)
  parts.push(`\`out\` picks a file or folder for the result. Returns a summary line and JSON ${JOB_SHAPE} with the saved file paths, never file contents.`)
  return parts.join(' ')
}

const EXTRA_TOOLS: Tool[] = [
  {
    name: 'sparky_list_ops',
    description: 'Lists every Sparky tool (convert, PDF, video, image, OCR, download) with its MCP tool name, whether it can run on this computer, and which program is missing when it cannot. Use it before calling a tool that needs an optional program such as Ghostscript or LibreOffice.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'sparky_list_formats',
    description: 'Lists the formats Sparky reads and writes. Give `paths` to learn what each of those local files can be converted to (the `output` values sparky_convert accepts for it), and which targets need a program that is missing.',
    inputSchema: {
      type: 'object',
      properties: { paths: { type: 'array', items: { type: 'string', minLength: 1 }, description: 'Local files to list conversion targets for. Left out: every format.' } },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'sparky_get_job',
    description: `Reports a Sparky job by id: status (queued, running, done, failed, canceled, paused), progress from 0 to 1 while running, output paths once done, and the error when it failed. Use it after calling a tool with wait=false. Returns ${JOB_SHAPE}.`,
    inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1, description: 'A job id from a tool result.' } }, required: ['id'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'sparky_cancel_job',
    description: 'Cancels a queued or running Sparky job by id. Files it already finished stay; the one in progress is removed. Returns the job as it is after canceling.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1, description: 'A job id from a tool result.' } }, required: ['id'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]

/** Every tool the server lists: the registry's ops, then the fixed helpers. */
export function mcpTools(ops: readonly OpDescriptor[]): Tool[] {
  return [
    ...ops.map(
      (op): Tool => ({
        name: toolName(op.id),
        title: op.label,
        description: toolDescription(op),
        inputSchema: toolInputSchema(op),
        annotations: {
          title: op.label,
          readOnlyHint: false,
          // Only an op that can replace or bin the originals changes anything but new files.
          destructiveHint: Boolean((op.inputSchema as ObjectSchema).properties?.originals),
          idempotentHint: false,
          openWorldHint: op.accepts.length === 0,
        },
      }),
    ),
    ...EXTRA_TOOLS,
  ]
}

// ── Calls ───────────────────────────────────────────────────────────────────────────────────────

/** Replaces each secret value in text sent back, so a password never leaves through an error message. */
function scrub(text: string, secrets: readonly string[]): string {
  return secrets.reduce((t, s) => (s ? t.split(s).join('••••') : t), text)
}

function textResult(line: string, data: unknown, isError = false, secrets: readonly string[] = []): CallToolResult {
  const text = scrub(`${line}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``, secrets)
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) }
}

export function errorResult(e: unknown, secrets: readonly string[] = []): CallToolResult {
  const field = e instanceof BackendError && e.field ? ` (field: ${e.field})` : ''
  return { content: [{ type: 'text', text: scrub(`${messageOf(e)}${field}`, secrets) }], isError: true }
}

export function jobsResult(label: string, jobs: readonly Job[], secrets: readonly string[] = []): CallToolResult {
  const bad = jobs.some((j) => j.status === 'failed' || j.status === 'canceled')
  return textResult(headline(label, jobs), { jobs: jobs.map(summarize) }, bad, secrets)
}

/** Picks the app when it is open (jobs show in its Queue), else a local engine made once and kept. Remembers where each job went. */
export class McpRouter {
  private local?: Promise<LocalBackend>
  private remote?: { at: number; backend?: Backend }
  private readonly owners = new Map<string, Backend>()
  constructor(private readonly forceLocal = localForced()) {}

  private localBackend(): Promise<LocalBackend> {
    this.local ??= LocalBackend.create(cliPaths())
    return this.local
  }

  async pick(): Promise<Backend> {
    if (this.forceLocal) return this.localBackend()
    const now = Date.now()
    if (!this.remote || now - this.remote.at > 3000) this.remote = { at: now, backend: await connectRemote(cliPaths(), (m) => console.error(m)) }
    return this.remote.backend ?? this.localBackend()
  }

  own(b: Backend, jobs: readonly Job[]): void {
    for (const j of jobs) this.owners.set(j.id, b)
  }

  async owner(id: string): Promise<Backend> {
    return this.owners.get(id) ?? this.pick()
  }

  async close(): Promise<void> {
    if (this.local) await (await this.local).close()
  }
}

type Extra = {
  signal: AbortSignal
  _meta?: { progressToken?: string | number }
  sendNotification?: (n: { method: 'notifications/progress'; params: { progressToken: string | number; progress: number; total?: number; message?: string } }) => Promise<void>
}

export async function callTool(router: McpRouter, ops: readonly OpDescriptor[], name: string, input: Record<string, unknown>, extra?: Extra): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'sparky_list_ops': {
        const b = await router.pick()
        const list = (await b.listOps()).map((o) => ({ tool: toolName(o.id), id: o.id, label: o.label, available: o.available, missing: o.missing }))
        const down = list.filter((o) => !o.available)
        return textResult(`${list.length} tools; ${down.length ? `${down.length} can't run here: ${down.map((o) => `${o.tool} (needs ${o.missing.map(toolLabel).join(', ')})`).join(', ')}` : 'all can run here'}.`, { ops: list })
      }
      case 'sparky_list_formats': {
        const b = await router.pick()
        const paths = Array.isArray(input.paths) ? input.paths.filter((p): p is string => typeof p === 'string') : []
        if (paths.length) {
          const targets = await b.targetsFor(paths)
          return textResult(targets.map((t) => `${t.path}: ${[...new Set(t.targets.filter((x) => x.available).map((x) => x.ext))].join(', ') || 'nothing'}`).join('\n'), { targets })
        }
        const info = await b.listFormats()
        return textResult(`Sparky reads ${info.inputs.length} file types and writes ${info.formats.length} formats.`, info)
      }
      case 'sparky_get_job':
      case 'sparky_cancel_job': {
        const id = typeof input.id === 'string' ? input.id : ''
        if (!id) return errorResult(new Error('Give the job `id`.'))
        const b = await router.owner(id)
        const job = name === 'sparky_get_job' ? await b.getJob(id) : await b.cancelJob(id)
        if (!job) return errorResult(new Error(`No job ${id}. Jobs are kept while the Sparky app or this server runs.`))
        return textResult(headline(job.title, [job]), { jobs: [summarize(job)] })
      }
    }
    const op = ops.find((o) => toolName(o.id) === name)
    if (!op) return errorResult(new Error(`Unknown tool ${name}. sparky_list_ops lists the tools.`))
    const { wait, ...args } = input
    const secrets = op.secret.map((k) => args[k]).filter((v): v is string => typeof v === 'string' && v.length > 0)
    try {
      const b = await router.pick()
      if (wait === false) {
        const jobs = await b.startOp(op.id, args)
        router.own(b, jobs)
        return textResult(`${op.label}: started ${jobs.length} job${jobs.length === 1 ? '' : 's'}. Call sparky_get_job with each id for its status and outputs.`, { jobs: jobs.map(summarize) }, false, secrets)
      }
      const token = extra?._meta?.progressToken
      let lastSent = -1
      const jobs = await b.runOp(op.id, args, {
        signal: extra?.signal,
        onUpdate(list) {
          router.own(b, list)
          if (token === undefined || !extra?.sendNotification) return
          const frac = list.reduce((s, j) => s + (j.status === 'done' ? 1 : Math.max(0, j.progress)), 0) / Math.max(1, list.length)
          const pct = Math.floor(frac * 100)
          if (pct === lastSent) return
          lastSent = pct
          void extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: frac, total: 1 } }).catch(() => undefined)
        },
      })
      return jobsResult(op.label, jobs, secrets)
    } catch (e) {
      return errorResult(e, secrets)
    }
  } catch (e) {
    return errorResult(e)
  }
}

export const INSTRUCTIONS = [
  'Sparky converts files and runs PDF, video, image and OCR tools on this computer, and downloads video or audio from links.',
  'Every tool takes local file paths and writes its results to disk; results come back as file paths, never file contents.',
  'Results go to `out` when given (a file or a folder), else to the Sparky output folder (Downloads\\Sparky by default).',
  'Calls wait for the job by default. For long videos, pass wait=false and poll sparky_get_job.',
  'When the Sparky app is open the jobs show in its Queue.',
].join(' ')

/** Runs until stdin closes. */
export async function runMcpServer(): Promise<void> {
  // A stray console.log would corrupt the protocol stream.
  console.log = console.error
  console.info = console.error
  console.debug = console.error
  const ops = listOps()
  const tools = mcpTools(ops)
  const router = new McpRouter()
  const server = new Server({ name: 'sparky', title: 'Sparky', version: VERSION }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))
  server.setRequestHandler(CallToolRequestSchema, async (req, extra) =>
    callTool(router, ops, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>, {
      signal: extra.signal,
      _meta: req.params._meta,
      sendNotification: (n) => extra.sendNotification(n),
    }),
  )
  const closed = new Promise<void>((resolve) => {
    server.onclose = () => resolve()
  })
  await server.connect(new StdioServerTransport())
  process.stdin.once('end', () => void server.close())
  await closed
  await router.close()
}
