// Exit codes and the two error kinds every command can throw.

export const EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  unavailable: 3,
  interrupted: 130,
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

/** A problem the command line itself can name: exits with `code`, prints only the message. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = EXIT.failed,
  ) {
    super(message)
    this.name = 'CliError'
  }
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, EXIT.usage)
    this.name = 'UsageError'
  }
}

/** What the engine or the HTTP API refused, with its code: 'invalid_input', 'unknown_op', 'unavailable', 'not_found', … */
export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field?: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

const CODE_EXIT: Record<string, ExitCode> = {
  unavailable: EXIT.unavailable,
  invalid_input: EXIT.usage,
  invalid_request: EXIT.usage,
  unknown_op: EXIT.usage,
  not_found: EXIT.usage,
}

export function exitCodeFor(e: unknown): ExitCode {
  if (e instanceof CliError) return e.code
  if (e instanceof BackendError) return CODE_EXIT[e.code] ?? EXIT.failed
  return EXIT.failed
}

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
