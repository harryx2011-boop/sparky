// Which ops `sparky mcp` offers an agent. Every tool's schema costs the agent context, so the default is the core set.
import type { OpDescriptor } from '@sparky/engine'
import { UsageError } from './errors'

export const CORE_OPS = ['convert', 'download', 'pdf.merge', 'pdf.split', 'pdf.compress', 'media.compress', 'media.edit', 'ocr', 'image.edit'] as const

/** A profile is a list of op ids; null keeps every op. A new profile is one row. */
export const PROFILES: Record<string, readonly string[] | null> = { core: CORE_OPS, all: null }

export const DEFAULT_PROFILE = 'core'

/** `--tools` wins over SPARKY_MCP_TOOLS, which wins over the default. */
export function profileFrom(flag: string | undefined, env: Record<string, string | undefined> = process.env): string {
  const name = flag ?? (env.SPARKY_MCP_TOOLS?.trim() || DEFAULT_PROFILE)
  if (!Object.hasOwn(PROFILES, name)) throw new UsageError(`Unknown tool profile "${name}". Choose one of: ${Object.keys(PROFILES).join(', ')}.`)
  return name
}

export function selectOps<T extends Pick<OpDescriptor, 'id'>>(profile: string, ops: readonly T[]): T[] {
  const ids = PROFILES[profile]
  return ids ? ops.filter((o) => ids.includes(o.id)) : [...ops]
}
