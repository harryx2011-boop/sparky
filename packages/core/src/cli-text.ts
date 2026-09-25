// Words the `sparky` command line shows that the engine and the app share: queue states and how secrets are given.

/** A job the CLI or an agent was waiting on left the app's queue (removed, or cleared) before it finished. */
export const JOB_REMOVED_FROM_QUEUE = 'Removed from the queue'

/** The environment variable that can hold a secret field: `userPassword` → SPARKY_USER_PASSWORD. */
export function secretEnvName(field: string): string {
  return `SPARKY_${field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase()}`
}

/** The three ways to give a secret without it landing in shell history or the process list. */
export function secretWays(flag: string, field: string): string {
  return `use "${flag} -" to read it from stdin, set ${secretEnvName(field)}, or leave it out to be asked`
}

/** A secret typed on the command line itself. */
export function secretOnCommandLineError(flag: string, field: string): string {
  return `${flag} can't take the value on the command line, where it would stay in your shell history and the process list: ${secretWays(flag, field)}.`
}

/** Help text for a secret field. */
export function secretHelp(flag: string, field: string): string {
  return `Never typed on the command line: ${secretWays(flag, field)}. Used for this job only, never saved.`
}

/** Two secret fields both asked to read stdin. */
export const SECRET_STDIN_TWICE = 'Only one option can read from stdin ("-") at a time; give the other through its environment variable.'
