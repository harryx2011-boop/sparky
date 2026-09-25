import type { OpDescriptor } from '@sparky/engine'
import { listOps } from '@sparky/engine'
import { describe, expect, it } from 'vitest'
import { COMMANDS, route } from '../src/commands'
import { bindOp } from '../src/commands/op'
import { opHelp, mainHelp } from '../src/help'
import { mcpTools, toolDescription, toolInputSchema } from '../src/mcp'

const fake = (over: Partial<OpDescriptor> & Pick<OpDescriptor, 'id' | 'label'>): OpDescriptor => ({
  doneLabel: 'Done',
  category: 'tool',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  requires: [],
  secret: [],
  accepts: ['pdf'],
  inputSchema: {
    type: 'object',
    required: ['files'],
    properties: {
      files: { type: 'array', minItems: 1, items: { type: 'string' }, title: 'PDF files', description: 'The PDFs to work on.' },
      mode: { type: 'string', enum: ['fast', 'small'], title: 'Mode', description: 'How hard to try.', labels: { fast: 'Quick', small: 'Smallest file' } },
      keepLinks: { type: 'boolean', default: true, title: 'Keep links' },
      password: { type: 'string', title: 'Password' },
      out: { type: 'string', minLength: 1 },
    },
  },
  ...over,
})

const OPS: OpDescriptor[] = [
  fake({ id: 'convert', label: 'Convert a file', accepts: ['png', 'csv'], inputSchema: { type: 'object', required: ['files', 'output'], properties: { files: { type: 'array', items: { type: 'string' } }, output: { type: 'string' }, out: { type: 'string' } } } }),
  fake({ id: 'pdf.squash_pages', label: 'Squash PDF pages', requires: ['ghostscript'], secret: ['password'], arity: 'all' }),
  fake({ id: 'pdf.merge', label: 'Merge PDFs', arity: 'all' }),
  fake({ id: 'download', label: 'Download from a link', accepts: [], positional: ['urls'], inputSchema: { type: 'object', required: ['urls'], properties: { urls: { type: 'array', items: { type: 'string' } } } } }),
]

describe('route', () => {
  it('sends a dotted id through its two words, dashes or underscores', () => {
    for (const argv of [['pdf', 'squash-pages', 'a.pdf'], ['pdf', 'squash_pages', 'a.pdf'], ['pdf.squash_pages', 'a.pdf']]) {
      const r = route(argv, OPS)
      expect(r.kind).toBe('op')
      if (r.kind === 'op') {
        expect(r.op.id).toBe('pdf.squash_pages')
        expect(r.argv).toEqual(['a.pdf'])
      }
    }
  })

  it('sends a single-word op straight through', () => {
    const r = route(['convert', 'a.png', '--to', 'pdf'], OPS)
    expect(r.kind === 'op' && r.op.id).toBe('convert')
  })

  it('prefers a built-in command', () => {
    const r = route(['ops', '--json'], OPS)
    expect(r.kind === 'command' && r.command.name).toBe('ops')
  })

  it('prints group help for a bare group and names a near tool', () => {
    const g = route(['pdf'], OPS)
    expect(g.kind === 'text' && g.text).toContain('squash-pages')
    expect(() => route(['pdf', 'mrege'], OPS)).toThrow(/Did you mean "sparky pdf merge"/)
  })

  it('suggests a command for a typo and prints main help for nothing', () => {
    expect(() => route(['frmats'], OPS)).toThrow(/sparky formats/)
    const h = route([], OPS)
    expect(h.kind === 'text' && h.text).toMatch(/pdf <tool>\s+squash-pages, merge/)
  })

  it('turns "help pdf merge" into that tool\'s help', () => {
    const r = route(['help', 'pdf', 'merge'], OPS)
    expect(r.kind === 'op' && r.argv).toEqual(['--help'])
  })

  it('binds a fake op from its schema', () => {
    const op = OPS[1]!
    expect(bindOp(op, ['a.pdf', 'b.pdf', '--mode', 'SMALL', '--no-keep-links']).args).toEqual({ files: ['a.pdf', 'b.pdf'], mode: 'small', keepLinks: false })
  })
})

describe('help text', () => {
  const text = opHelp(OPS[1]!)

  it('shows usage, arity and what it needs', () => {
    expect(text).toContain('Usage: sparky pdf squash-pages <files...> [options]')
    expect(text).toContain('All the files go into one result.')
    expect(text).toContain('Needs: Ghostscript.')
  })

  it('shows each field with its title, description, labels and default', () => {
    const flat = text.replace(/\s+/g, ' ')
    expect(flat).toContain('--mode <fast|small> Mode. How hard to try. Choices: fast = Quick, small = Smallest file.')
    expect(flat).toContain('--keep-links, --no-keep-links Keep links. Default: true.')
    expect(flat).toContain('--password - Password. Never typed on the command line: use "--password -" to read it from stdin, set SPARKY_PASSWORD, or leave it out to be asked. Used for this job only, never saved.')
    expect(flat).toContain('--out <path> Save to.')
  })

  it('offers --to beside --output', () => {
    expect(opHelp(OPS[0]!)).toContain('--output, --to <value>')
  })

  it('lists every built-in command in the main help', () => {
    const main = mainHelp(OPS, COMMANDS)
    for (const c of COMMANDS) expect(main).toContain(c.usage)
    expect(main).toContain('SPARKY_BIN_DIR')
    expect(main).toContain('SPARKY_TEST_BIN')
  })
})

describe('MCP tools from descriptors', () => {
  const tools = mcpTools(OPS)

  it('names one tool per op plus the four helpers', () => {
    expect(tools.map((t) => t.name)).toEqual(['sparky_convert', 'sparky_pdf_squash_pages', 'sparky_pdf_merge', 'sparky_download', 'sparky_list_ops', 'sparky_list_formats', 'sparky_get_job', 'sparky_cancel_job'])
  })

  it('adds wait, folds labels into descriptions and drops the labels keyword', () => {
    const s = toolInputSchema(OPS[1]!) as { properties: Record<string, Record<string, unknown>>; required: string[] }
    expect(s.properties.wait).toMatchObject({ type: 'boolean', default: true })
    expect(s.properties.mode!.labels).toBeUndefined()
    expect(s.properties.mode!.description).toBe('How hard to try. Choices: fast = Quick, small = Smallest file.')
    expect(s.properties.password!.description).toMatch(/never stored or echoed/)
    expect(s.required).toEqual(['files'])
  })

  it('tells an agent when to use it, what it takes and what it returns', () => {
    const d = toolDescription(OPS[1]!)
    expect(d).toContain('Squash PDF pages')
    expect(d).toContain('Takes local files (pdf)')
    expect(d).toContain('one job with one result')
    expect(d).toContain('Needs Ghostscript')
    expect(d).toContain('never file contents')
    expect(toolDescription(OPS[0]!)).toContain('Set `output` to the target extension')
    expect(toolDescription(OPS[3]!)).toContain('web links')
  })

  it('covers the real registry with valid names and object schemas', () => {
    const real = mcpTools(listOps())
    for (const t of real) {
      expect(t.name).toMatch(/^sparky_[a-z0-9_]+$/)
      expect(t.inputSchema.type).toBe('object')
      expect(t.description!.length).toBeGreaterThan(60)
    }
    expect(real.find((t) => t.name === 'sparky_pdf_merge')?.description).toMatch(/PDF/)
  })
})
