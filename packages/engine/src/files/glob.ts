// Windows-style glob, case-insensitive: `*` and `?` stay inside one folder, `**` crosses folders. A glob with no slash matches the name only.

export type Matcher = (name: string, rel: string) => boolean

export function globMatcher(glob: string): Matcher {
  const pattern = glob.replace(/\\/g, '/')
  let src = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '*' && pattern[i + 1] === '*') {
      src += '.*'
      i++
      if (pattern[i + 1] === '/') i++
    } else if (c === '*') src += '[^/]*'
    else if (c === '?') src += '[^/]'
    else src += c.replace(/[.+^${}()|[\]\\/]/g, '\\$&')
  }
  const re = new RegExp(`^${src}$`, 'i')
  return pattern.includes('/') ? (_name, rel) => re.test(rel.replace(/\\/g, '/')) : (name) => re.test(name)
}
