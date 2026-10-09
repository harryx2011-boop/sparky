// `sparky mcp`: starts the stdio MCP server.
import { parseArgv } from '../args'
import { EXIT, UsageError } from '../errors'
import { runMcpServer } from '../mcp'
import type { Command } from './types'

export const mcpCommand: Command = {
  name: 'mcp',
  usage: 'mcp [--tools core|all]',
  summary: 'Run the MCP server on stdin/stdout, for Claude Code, Cursor, Codex and other agents.',
  help: [
    'Usage: sparky mcp [--tools core|all]',
    '',
    'Speaks MCP over stdin and stdout until stdin closes. Agent clients start it themselves; "sparky init" adds it to them.',
    'Claude Code by hand: claude mcp add --scope user sparky -- sparky mcp',
    '',
    '--tools core (default) offers convert, download, PDF merge/split/compress, video compress/edit, OCR and image edit; all offers every tool.',
    'Agents can only use files under SPARKY_MCP_ROOTS (default: the Sparky output folder and the folder the client started in).',
    'Saving over originals is off unless SPARKY_MCP_ALLOW_REPLACE=1.',
  ].join('\n'),
  async run(argv, { io }) {
    const raw = parseArgv(argv, { booleans: new Set(['help']) })
    if (raw.flags.get('help')) return (io.out(this.help), EXIT.ok)
    const tools = raw.flags.get('tools')
    if (raw.positionals.length || [...raw.flags.keys()].some((k) => k !== 'help' && k !== 'tools') || (tools !== undefined && typeof tools !== 'string')) {
      throw new UsageError('"sparky mcp" takes only --tools core|all.')
    }
    await runMcpServer(tools)
    return EXIT.ok
  },
}
