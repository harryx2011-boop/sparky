// The op contract: every capability the app, the HTTP API, the MCP server and the CLI offer is one of these.
import type { Category, GpuInfo, HistoryEntry, Job, JobKind, JobStage, Settings } from '@sparky/core'
import type { z } from 'zod/v4'
import type { EngineHost } from '../convert'
import type { OutputPlan, OutputRequest } from '../output'
import type { ToolId, Tools } from '../tools'

export type Capability = ToolId | 'print' | 'trash'

export type OpCategory = Category | 'convert' | 'download' | 'pdf' | 'tool'

export interface OpTarget {
  ext: string
  requires?: Capability[]
}

export interface OpProgress {
  fraction?: number | null
  speed?: string
  eta?: number
  stage?: JobStage
  note?: string
}

export interface OpContext {
  tools: Tools
  gpu: GpuInfo
  cores: number
  settings(): Settings
  host: EngineHost
  tempDir: string
  dataDir?: string
  signal: AbortSignal
  progress(p: OpProgress): void
  out?: string
  output(req: OutputRequest): Promise<OutputPlan>
}

export interface OpResult {
  outputs: string[]
  sizeBefore?: number
  sizeAfter?: number
  warnings?: string[]
}

export type OpJobFields = Pick<Job, 'title' | 'source' | 'category' | 'convert' | 'download'>

export interface Op<I extends z.ZodObject = z.ZodObject> {
  id: string
  label: string
  doneLabel: string
  category: OpCategory
  kind: JobKind
  arity: 'each' | 'all'
  positional: string[]
  resumable: boolean
  input: I
  secret?: string[]
  paths?: string[]
  accepts(ext: string): boolean
  targets?(ext: string): OpTarget[]
  requires?: ToolId[]
  needs?(args: z.infer<I>): Capability[]
  many?(args: z.infer<I>): boolean
  describe?(args: z.infer<I>, settings: Settings): Partial<OpJobFields>
  fromHistory?(entry: HistoryEntry): Record<string, unknown> | undefined
  run(ctx: OpContext, args: z.infer<I>): Promise<OpResult>
}

export type OpInputCode = 'unknown_op' | 'invalid_input' | 'unavailable'

export class OpInputError extends Error {
  constructor(
    public readonly code: OpInputCode,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'OpInputError'
  }
}
