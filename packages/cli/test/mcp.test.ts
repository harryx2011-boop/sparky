// `sparky mcp` over real stdio, driven by the SDK's own client.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { listOps } from '@sparky/engine'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BUNDLE, childEnv, FIXTURES, tempDir } from './helpers'

const PDF = path.join(FIXTURES, 'report.pdf')
const CSV = path.join(FIXTURES, 'document', 'sample.csv')

type Content = { type: string; text?: string }[]
const textOf = (r: unknown) => ((r as { content: Content }).content).map((c) => c.text ?? '').join('\n')
const jsonOf = (r: unknown) => JSON.parse(/```json\n([\s\S]*)\n```/.exec(textOf(r))![1]!) as { jobs: { id: string; status: string; outputs: string[] }[] }

let dir: string
let client: Client
let stderr = ''

beforeAll(async () => {
  dir = tempDir('sparky-mcp-')
  const env = childEnv(path.join(dir, 'data'), { SPARKY_LOCAL: '1' }) as Record<string, string>
  const transport = new StdioClientTransport({ command: process.execPath, args: [BUNDLE, 'mcp'], env, stderr: 'pipe' })
  transport.stderr?.on('data', (d) => (stderr += d))
  client = new Client({ name: 'sparky-test', version: '0.0.0' })
  await client.connect(transport)
})
afterAll(async () => {
  await client?.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('sparky mcp', () => {
  it('lists one tool per op plus the four helpers', async () => {
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(listOps().length + 4)
    const merge = tools.find((t) => t.name === 'sparky_pdf_merge')
    expect(merge?.description).toMatch(/PDF/)
    expect(merge?.inputSchema.properties).toHaveProperty('wait')
    for (const name of ['sparky_convert', 'sparky_download', 'sparky_media_edit', 'sparky_list_ops', 'sparky_list_formats', 'sparky_get_job', 'sparky_cancel_job']) {
      expect(tools.map((t) => t.name)).toContain(name)
    }
    expect(client.getInstructions()).toMatch(/file paths, never file contents/)
  })

  it('answers sparky_list_formats, with and without paths', async () => {
    const all = await client.callTool({ name: 'sparky_list_formats', arguments: {} })
    expect(all.isError).toBeFalsy()
    expect(textOf(all)).toMatch(/reads \d+ file types/)
    const one = await client.callTool({ name: 'sparky_list_formats', arguments: { paths: [CSV] } })
    expect(textOf(one)).toMatch(/sample\.csv: .*xlsx/)
  })

  it('merges two PDFs and returns the output path, not the bytes', async () => {
    const out = path.join(dir, 'merged.pdf')
    const r = await client.callTool({ name: 'sparky_pdf_merge', arguments: { files: [PDF, PDF], out } })
    expect(r.isError).toBeFalsy()
    const { jobs } = jsonOf(r)
    expect(jobs[0]).toMatchObject({ status: 'done', outputs: [out] })
    expect(fs.readFileSync(out).subarray(0, 5).toString()).toBe('%PDF-')
    expect(textOf(r)).not.toContain('%PDF')
  })

  it('returns job ids with wait=false, then reports them through sparky_get_job', async () => {
    const r = await client.callTool({ name: 'sparky_convert', arguments: { files: [CSV], output: 'json', out: path.join(dir, 'later') + path.sep, wait: false } })
    const [job] = jsonOf(r).jobs
    let status = job!.status
    for (let i = 0; i < 100 && !['done', 'failed'].includes(status); i++) {
      await new Promise((res) => setTimeout(res, 100))
      status = jsonOf(await client.callTool({ name: 'sparky_get_job', arguments: { id: job!.id } })).jobs[0]!.status
    }
    expect(status).toBe('done')
  })

  it('maps bad input to isError with the plain message', async () => {
    const r = await client.callTool({ name: 'sparky_pdf_merge', arguments: {} })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/files/)
    const unknown = await client.callTool({ name: 'sparky_get_job', arguments: { id: 'nope' } })
    expect(unknown.isError).toBe(true)
  })

  it('never echoes a secret field', async () => {
    const secret = 'hunter2-very-secret'
    const r = await client.callTool({ name: 'sparky_pdf_unlock', arguments: { files: [path.join(dir, 'missing.pdf')], password: secret } })
    expect(textOf(r)).not.toContain(secret)
  })

  it('writes nothing but protocol to stdout', () => {
    // Any stray stdout line would have broken the client above; stderr may hold logs.
    expect(stderr).not.toMatch(/SyntaxError|Unexpected token/)
  })
})
