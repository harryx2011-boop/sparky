// The op contract: every capability the app, the HTTP API, the MCP server and the CLI offer is one of these.
import type { Category, GpuInfo, HistoryEntry, Job, JobKind, JobStage, Settings } from '@sparky/core'
import type { z } from 'zod/v4'
import type { EngineHost } from '../convert'
import type { OutputPlan, OutputRequest } from '../output'
import type { ToolId, Tools } from '../tools'

/** A tool Sparky finds on disk, or something only the running app lends ('print', 'trash'). */
export type Capability = ToolId | 'print' | 'trash'

export type OpCategory = Category | 'convert' | 'download' | 'pdf' | 'tool'

export interface OpTarget {
  ext: string
  /** What this target needs beyond the op itself: docx → pdf needs 'print', xls → pdf needs 'libreoffice'. */
  requires?: Capability[]
}

export interface OpProgress {
  /** 0–1, or null when it can't be measured. Leave it out to keep the current value. */
  fraction?: number | null
  speed?: string
  /** Seconds left. */
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
  /** This process's own scratch folder. */
  tempDir: string
  /** The app's data folder, for caches that outlive a job. */
  dataDir?: string
  /** Aborted on cancel or pause; long steps check it and throw CanceledError. */
  signal: AbortSignal
  progress(p: OpProgress): void
  /** The caller's output file or folder, when one was given. */
  out?: string
  /** Where a result goes: the caller's `out`, else beside the source for originals "replace", else the output root. */
  output(req: OutputRequest): Promise<OutputPlan>
}

export interface OpResult {
  outputs: string[]
  sizeBefore?: number
  sizeAfter?: number
  /** Shown on the finished job, joined into one note. */
  warnings?: string[]
}

/** The queue row a job shows. `convert`/`download` keep the app's History and rerun working for those two ops. */
export type OpJobFields = Pick<Job, 'title' | 'source' | 'category' | 'convert' | 'download'>

export interface Op<I extends z.ZodObject = z.ZodObject> {
  /** 'convert', 'pdf.merge', 'image.resize', 'ocr'. */
  id: string
  /** Plain language, for the app and the CLI help. From core. */
  label: string
  /** Past tense for the finished notification, e.g. "Converted". From core. */
  doneLabel: string
  category: OpCategory
  /** The app's bucket: queue icon and History filter. */
  kind: JobKind
  /** 'each': one job per item of the first positional field; 'all': one job for the whole input. */
  arity: 'each' | 'all'
  /** Input fields a CLI takes as bare arguments, in order. */
  positional: string[]
  /** A paused job picks up where it stopped instead of starting over. */
  resumable: boolean
  /** Flat, transform-free zod/v4 object. The engine adds `out`; never declare it here. */
  input: I
  /** Input fields that must never be stored or shown: they stay out of the job, the queue snapshot and History, so a rerun asks for them again. */
  secret?: string[]
  /** Input fields holding local paths; the engine makes them absolute so a rerun, or another process, finds the same files. */
  paths?: string[]
  /** Which sources this op takes. */
  accepts(ext: string): boolean
  targets?(ext: string): OpTarget[]
  /** Hides the whole op when any is missing. */
  requires?: ToolId[]
  /** What these particular args need, checked before the job is queued. */
  needs?(args: z.infer<I>): Capability[]
  /** These args make more than one file, so `out` can't name a single file. */
  many?(args: z.infer<I>): boolean
  describe?(args: z.infer<I>, settings: Settings): Partial<OpJobFields>
  /** Rebuilds the input from a History row written before ops existed. */
  fromHistory?(entry: HistoryEntry): Record<string, unknown> | undefined
  run(ctx: OpContext, args: z.infer<I>): Promise<OpResult>
}

export type OpInputCode = 'unknown_op' | 'invalid_input' | 'unavailable'

/** Raised by startOp before anything is queued. `field` is the input path that's wrong, when there is one. */
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
