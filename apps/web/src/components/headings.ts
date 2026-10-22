export const H1 = 'text-balance text-[clamp(32px,calc(2vw+22px),48px)] font-bold leading-[1.06] tracking-[-0.035em]'
export const H2 = 'mb-4 text-2xl font-semibold leading-tight tracking-[-0.01em]'

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

/** Title Case for a legal heading: every word capitalized except small words in the middle. */
export function titleCase(heading: string): string {
  const words = heading.split(' ')
  return words
    .map((w, i) => (i > 0 && i < words.length - 1 && SMALL.has(w) ? w : w.replace(/(^|-)(\p{L})/gu, (_, dash: string, letter: string) => dash + letter.toUpperCase())))
    .join(' ')
}
