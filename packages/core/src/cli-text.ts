// Words the `sparky` command line shows that the engine and the app share: queue states and how secrets are given.

export const JOB_REMOVED_FROM_QUEUE = 'Removed from the queue'

export function secretEnvName(field: string): string {
  return `SPARKY_${field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase()}`
}

export function secretWays(flag: string, field: string): string {
  return `use "${flag} -" to read it from stdin, set ${secretEnvName(field)}, or leave it out to be asked`
}

export function secretOnCommandLineError(flag: string, field: string): string {
  return `${flag} can't take the value on the command line, where it would stay in your shell history and the process list: ${secretWays(flag, field)}.`
}

export function secretHelp(flag: string, field: string): string {
  return `Never typed on the command line: ${secretWays(flag, field)}. Used for this job only, never saved.`
}

export const SECRET_STDIN_TWICE = 'Only one option can read from stdin ("-") at a time; give the other through its environment variable.'
