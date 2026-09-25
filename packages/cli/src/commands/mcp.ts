// `sparky mcp`: starts the stdio MCP server.
import { parseArgv } from '../args'
import { EXIT, UsageError } from '../errors'
import { runMcpServer } from '../mcp'
import type { Command } from './types'

export const mcpCommand: Command = {
  name: 'mcp',
  usage: 'mcp',
  summary: 'Run the MCP server on stdin/stdout, for Claude Code, Cursor, Codex and other agents.',
  help: [
    'Usage: sparky mcp',
    '',
    'Speaks MCP over stdin and stdout until stdin closes. Agent clients start it themselves; "sparky init" adds it to them.',
    'Claude Code by hand: claude mcp add --scope user sparky -- sparky mcp',
  ].join('\n'),
  async run(argv, { io }) {
    const raw = parseArgv(argv, { booleans: new Set(['help']) })
    if (raw.flags.get('help')) return (io.out(this.help), EXIT.ok)
    if (raw.positionals.length || [...raw.flags.keys()].some((k) => k !== 'help')) throw new UsageError('"sparky mcp" takes no arguments.')
    await runMcpServer()
    return EXIT.ok
  },
}
