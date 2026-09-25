// The local HTTP API: loopback only, bearer token, the op registry over JSON. Hosted by the app on 8600, or by `sparky serve`.
import { API_UNAUTHORIZED, apiBadPortError, apiLoopbackOnlyError, apiRouteNotFoundError } from '@sparky/core'
import Fastify from 'fastify'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { Engine } from '../index'
import { ensureToken } from '../token'
import { ApiError, errorBody, toApiError } from './errors'
import { ROUTES, type ApiHost } from './routes'

export const DEFAULT_API_PORT = 8600
export const API_BIND = '127.0.0.1'

/** The port the API uses: the caller's, else `SPARKY_API_PORT`, else 8600. A client calls it with no argument to find the server. */
export function apiPort(port?: number): number {
  if (port !== undefined) return port
  const env = process.env.SPARKY_API_PORT?.trim()
  if (!env) return DEFAULT_API_PORT
  const n = Number(env)
  if (!/^\d+$/.test(env) || n > 65535) throw new Error(apiBadPortError(env))
  return n
}

export interface ApiServerOptions {
  /** Where the token file lives: the engine's data folder. */
  dataDir: string
  /** 0 picks a free port. Default: apiPort(). */
  port?: number
  /** Reported by /v1/health, so a client knows whether its jobs show in the app's Queue. */
  host: ApiHost
  version: string
  /** Only 127.0.0.1 is accepted; anything else throws before listening. */
  bind?: string
}

export interface ApiServer {
  port: number
  token: string
  close(): Promise<void>
}

/** A long file list must never be refused; only JSON with local paths comes in. */
const BODY_LIMIT = 1024 * 1024 * 1024

const BEARER = /^\s*bearer\s+(\S+)\s*$/i

const digest = (s: string) => createHash('sha256').update(s).digest()

export async function startApiServer(engine: Engine, opts: ApiServerOptions): Promise<ApiServer> {
  const bind = opts.bind ?? API_BIND
  if (bind !== API_BIND) throw new Error(apiLoopbackOnlyError(bind))
  const port = apiPort(opts.port)
  const token = ensureToken(opts.dataDir)
  const expected = digest(token)

  const app = Fastify({
    logger: process.env.SPARKY_API_LOG === '1',
    bodyLimit: BODY_LIMIT,
    genReqId: () => randomUUID(),
    // Quitting the app must not wait on a client blocked in `wait: true`.
    forceCloseConnections: true,
  })

  // Every body is read as JSON whatever its content type; an empty one is no body.
  const json = app.getDefaultJsonParser('error', 'error')
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
    if (body === '') done(null, undefined)
    else json(req, body as string, done)
  })

  app.addHook('onRequest', async (req) => {
    if ((req.routeOptions.config as { public?: boolean }).public) return
    const sent = BEARER.exec(req.headers.authorization ?? '')?.[1] ?? ''
    // Hashing both sides gives equal lengths, so the comparison takes the same time whatever was sent.
    if (!timingSafeEqual(digest(sent), expected)) throw new ApiError(401, 'unauthorized', API_UNAUTHORIZED)
  })

  app.setErrorHandler((err, req, reply) => {
    const e = toApiError(err)
    if (e.status >= 500) req.log.error(err)
    void reply.status(e.status).send(errorBody(e, req.id))
  })

  app.setNotFoundHandler((req, reply) => {
    const e = new ApiError(404, 'not_found', apiRouteNotFoundError(req.method, req.url.split('?')[0]!))
    void reply.status(404).send(errorBody(e, req.id))
  })

  for (const route of ROUTES) {
    app.route({
      method: route.method,
      url: route.url,
      config: { public: route.public === true },
      handler: async (req, reply) => {
        const res = await route.handle({
          engine,
          version: opts.version,
          host: opts.host,
          token,
          params: req.params as Record<string, string>,
          query: req.query as Record<string, string | undefined>,
          body: req.body,
        })
        return reply.status(res.status ?? 200).send(res.body)
      },
    })
  }

  try {
    await app.listen({ host: API_BIND, port })
  } catch (e) {
    await app.close().catch(() => undefined)
    throw e
  }
  const addr = app.server.address() as AddressInfo
  if (addr.address !== API_BIND) {
    await app.close()
    throw new Error(apiLoopbackOnlyError(addr.address))
  }
  return { port: addr.port, token, close: () => app.close() }
}
