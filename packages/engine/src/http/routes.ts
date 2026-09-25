// The API's routes as one table. A handler gets the engine and the parsed request and throws on failure; the server shapes the error.
import { API_BAD_NONCE, FORMATS, INPUT_EXTS, jobNotFoundError, type Job } from '@sparky/core'
import { createHmac } from 'node:crypto'
import { z } from 'zod/v4'
import type { Engine } from '../index'
import { ApiError, invalidRequest } from './errors'

export type ApiHost = 'app' | 'cli'

export interface RouteContext {
  engine: Engine
  version: string
  host: ApiHost
  /** The server's own token, for the hello proof. */
  token: string
  params: Record<string, string>
  query: Record<string, string | undefined>
  body: unknown
}

export interface RouteResult {
  status?: number
  body: unknown
}

export interface Route {
  method: 'GET' | 'POST' | 'DELETE'
  url: string
  /** Answered without the token. Only /v1/hello, which proves the server holds the token without asking for it. */
  public?: boolean
  handle(ctx: RouteContext): RouteResult | Promise<RouteResult>
}

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const res = schema.safeParse(body)
  if (!res.success) throw invalidRequest(res.error)
  return res.data
}

const TargetsBody = z.object({ paths: z.array(z.string().min(1)) })

const JobsBody = z.object({
  op: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
  wait: z.boolean().default(true),
  timeoutMs: z.number().int().positive().optional(),
})

function jobOr404(engine: Engine, id: string): Job {
  const job = engine.getJob(id)
  if (!job) throw new ApiError(404, 'not_found', jobNotFoundError(id), 'id')
  return job
}

const NONCE = /^[0-9a-f]{16,64}$/i

export const ROUTES: readonly Route[] = [
  {
    method: 'GET',
    url: '/v1/hello',
    public: true,
    // A client checks the proof before sending its token, so an impostor on the port never receives it.
    handle({ version, host, token, query }) {
      const nonce = query.nonce ?? ''
      if (!NONCE.test(nonce)) throw new ApiError(400, 'invalid_request', API_BAD_NONCE, 'nonce')
      return { body: { app: 'sparky', version, host, proof: createHmac('sha256', token).update(nonce).digest('hex') } }
    },
  },
  {
    method: 'GET',
    url: '/v1/health',
    handle: ({ version, host }) => ({ body: { ok: true, app: 'sparky', version, pid: process.pid, host } }),
  },
  { method: 'GET', url: '/v1/ops', handle: ({ engine }) => ({ body: { ops: engine.listOps() } }) },
  { method: 'GET', url: '/v1/formats', handle: () => ({ body: { formats: FORMATS, inputs: INPUT_EXTS } }) },
  {
    method: 'POST',
    url: '/v1/targets',
    handle: ({ engine, body }) => ({ body: { targets: engine.targetsFor(parse(TargetsBody, body).paths) } }),
  },
  {
    method: 'POST',
    url: '/v1/jobs',
    async handle({ engine, body }) {
      const { op, args, wait, timeoutMs } = parse(JobsBody, body)
      // No abort signal: a client that hangs up leaves its jobs running, as closing the app window does.
      if (wait) return { body: { jobs: await engine.runOp(op, args ?? {}, { timeoutMs }) } }
      return { status: 202, body: { jobs: engine.startOp(op, args ?? {}) } }
    },
  },
  { method: 'GET', url: '/v1/jobs', handle: ({ engine }) => ({ body: { jobs: engine.listJobs() } }) },
  { method: 'GET', url: '/v1/jobs/:id', handle: ({ engine, params }) => ({ body: { job: jobOr404(engine, params.id!) } }) },
  {
    method: 'DELETE',
    url: '/v1/jobs/:id',
    handle({ engine, params }) {
      const id = params.id!
      jobOr404(engine, id)
      engine.cancelJob(id)
      return { body: { job: jobOr404(engine, id) } }
    },
  },
]
