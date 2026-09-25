// `sparky serve`: the HTTP API without the app, on the engine in this process.
import { startApiServer, tokenPath } from '@sparky/engine'
import { parseArgv } from '../args'
import { createLocalEngine } from '../backend'
import { cliApiPort, cliPaths, VERSION } from '../env'
import { CliError, EXIT, messageOf, UsageError } from '../errors'
import type { Command } from './types'

export const serveCommand: Command = {
  name: 'serve',
  usage: 'serve [--port 8600]',
  summary: 'Run the local HTTP API without the app (127.0.0.1 only, bearer token).',
  help: [
    'Usage: sparky serve [--port <n>]',
    '',
    'Serves the Sparky HTTP API on 127.0.0.1 until Ctrl+C. The port defaults to SPARKY_API_PORT, else 8600.',
    'Clients send "Authorization: Bearer <token>" with the token from the file it prints. The app serves the same API while it is open.',
  ].join('\n'),
  async run(argv, { io }) {
    const raw = parseArgv(argv, { booleans: new Set(['help']) })
    for (const name of raw.flags.keys()) if (!['port', 'help'].includes(name)) throw new UsageError(`Unknown option --${name} for "sparky serve".`)
    if (raw.flags.get('help')) return (io.out(this.help), EXIT.ok)
    const given = raw.flags.get('port')?.at(-1)
    let port = cliApiPort()
    if (given !== undefined) {
      if (typeof given !== 'string' || !/^\d+$/.test(given) || Number(given) > 65535) throw new UsageError('--port takes a number from 0 to 65535.')
      port = Number(given)
    }

    const paths = cliPaths()
    const engine = await createLocalEngine(paths)
    let server
    try {
      server = await startApiServer(engine, { dataDir: paths.dataDir, port, host: 'cli', version: VERSION })
    } catch (e) {
      await engine.shutdown()
      if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE' || /EADDRINUSE/.test(messageOf(e)))
        throw new CliError(`Port ${port} is in use. The Sparky app may be open already; it serves the same API.`, EXIT.unavailable)
      throw e
    }
    io.out(`Sparky API on http://127.0.0.1:${server.port}`)
    io.out(`Token file: ${tokenPath(paths.dataDir)}`)
    io.err('Ctrl+C stops it.')

    await new Promise<void>((resolve) => {
      const stop = () => resolve()
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
    await server.close()
    await engine.shutdown()
    return EXIT.ok
  },
}
