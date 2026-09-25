// RemoteBackend against fake listeners: the health challenge before the token leaves, and jobs that leave the queue mid-wait.
import type { Job } from '@sparky/core'
import { createHmac } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { RemoteBackend } from '../src/backend'

const TOKEN = 'a'.repeat(64)

interface Seen {
  method: string
  url: string
  auth?: string
}

type Handler = (req: http.IncomingMessage, url: URL) => { status: number; body?: unknown } | undefined

let servers: http.Server[] = []
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))))
  servers = []
})

async function fake(handle: Handler): Promise<{ port: number; seen: Seen[] }> {
  const seen: Seen[] = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    seen.push({ method: req.method ?? '', url: url.pathname, auth: req.headers.authorization })
    req.resume()
    req.on('end', () => {
      const r = handle(req, url) ?? { status: 404, body: { error: 'not_found', message: 'No such route.' } }
      res.writeHead(r.status, { 'Content-Type': 'application/json' })
      res.end(r.body === undefined ? '' : JSON.stringify(r.body))
    })
  })
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { port: (server.address() as AddressInfo).port, seen }
}

const proof = (nonce: string, token = TOKEN) => createHmac('sha256', token).update(nonce).digest('hex')

/** A Sparky that answers the challenge with `token`. */
const sparky =
  (token: string, more: Handler = () => undefined): Handler =>
  (req, url) => {
    if (url.pathname === '/v1/hello') {
      const nonce = url.searchParams.get('nonce') ?? ''
      return { status: 200, body: { app: 'sparky', proof: proof(nonce, token) } }
    }
    if (url.pathname === '/v1/health') return req.headers.authorization === `Bearer ${TOKEN}` ? { status: 200, body: { ok: true, app: 'sparky', version: 'x', pid: 1, host: 'cli' } } : { status: 401, body: { error: 'unauthorized' } }
    return more(req, url)
  }

const job = (over: Partial<Job> = {}): Job => ({ id: 'j1', kind: 'tool', op: 'pdf.merge', title: 'Merge PDFs', source: 'a.pdf', status: 'queued', progress: 0, outputs: [], createdAt: 1, ...over })

describe('health challenge', () => {
  it('connects when the proof matches, and only then sends the token', async () => {
    const f = await fake(sparky(TOKEN))
    const { backend } = await RemoteBackend.connect({ port: f.port, token: TOKEN })
    expect(backend).toBeDefined()
    expect(f.seen[0]).toMatchObject({ url: '/v1/hello', auth: undefined })
    expect(f.seen[1]).toMatchObject({ url: '/v1/health', auth: `Bearer ${TOKEN}` })
  })

  it('treats a wrong proof as "not Sparky" and never sends the token', async () => {
    const f = await fake(sparky('b'.repeat(64)))
    const { backend } = await RemoteBackend.connect({ port: f.port, token: TOKEN })
    expect(backend).toBeUndefined()
    expect(f.seen.every((s) => s.auth === undefined)).toBe(true)
    expect(f.seen.map((s) => s.url)).toEqual(['/v1/hello'])
  })

  it('treats a listener without /v1/hello as "not Sparky"', async () => {
    const f = await fake((_req, url) => (url.pathname === '/v1/health' ? { status: 200, body: { ok: true, app: 'sparky' } } : undefined))
    const { backend } = await RemoteBackend.connect({ port: f.port, token: TOKEN })
    expect(backend).toBeUndefined()
    expect(f.seen.every((s) => s.auth === undefined)).toBe(true)
  })

  it('refuses a proof that is right for a different nonce', async () => {
    const f = await fake((_req, url) => (url.pathname === '/v1/hello' ? { status: 200, body: { app: 'sparky', proof: proof('0'.repeat(32)) } } : undefined))
    expect((await RemoteBackend.connect({ port: f.port, token: TOKEN })).backend).toBeUndefined()
  })
})

describe('waiting on a remote job', () => {
  it('settles a job that left the queue instead of waiting forever', async () => {
    let polls = 0
    const f = await fake(
      sparky(TOKEN, (req, url) => {
        if (req.method === 'POST' && url.pathname === '/v1/jobs') return { status: 202, body: { jobs: [job()] } }
        if (url.pathname === '/v1/jobs/j1') {
          polls++
          return polls === 1 ? { status: 200, body: { job: job({ status: 'running', progress: 0.3 }) } } : { status: 404, body: { error: 'not_found', message: 'No job j1.' } }
        }
        return undefined
      }),
    )
    const { backend } = await RemoteBackend.connect({ port: f.port, token: TOKEN })
    const jobs = await Promise.race([backend!.runOp('pdf.merge', { files: ['a.pdf'] }), new Promise<'hung'>((r) => setTimeout(() => r('hung'), 5000))])
    expect(jobs).not.toBe('hung')
    const [j] = jobs as Job[]
    expect(j).toMatchObject({ id: 'j1', status: 'canceled', note: 'Removed from the queue' })
    const pollsAtEnd = polls
    await new Promise((r) => setTimeout(r, 900))
    expect(polls).toBe(pollsAtEnd)
  })
})
