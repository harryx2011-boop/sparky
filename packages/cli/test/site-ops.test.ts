// The landing site's Tools list is a committed snapshot of the registry; this fails when it drifts.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { childEnv, CLI_DIR, runCli, tempDir } from './helpers'

const SITE_OPS = path.join(CLI_DIR, '..', '..', 'apps', 'web', 'src', 'data', 'ops.json')

interface OpRow {
  id: string
  label: string
  category: string
}

const rows = (ops: OpRow[]): OpRow[] => ops.map(({ id, label, category }) => ({ id, label, category }))

describe('apps/web/src/data/ops.json', () => {
  it('matches the registry', async () => {
    const res = await runCli(['ops', '--json', '--local'], childEnv(tempDir('sparky-site-ops-')))
    expect(res.code, res.stderr).toBe(0)
    const live = rows((JSON.parse(res.stdout) as { ops: OpRow[] }).ops)
    const site = rows(JSON.parse(fs.readFileSync(SITE_OPS, 'utf8')) as OpRow[])
    expect(site, 'The site Tools list is stale: run npm run gen:ops -w @sparky/web').toEqual(live)
  })
})
