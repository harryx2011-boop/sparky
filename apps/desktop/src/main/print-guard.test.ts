import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { allowPrintRequest } from './print-guard'

const root = path.resolve(path.parse(process.cwd()).root, 'docs')
const other = path.resolve(path.parse(process.cwd()).root, 'private')
const folders = [path.join(root, 'work'), path.join(root, 'book')]
const file = (...parts: string[]) => pathToFileURL(path.join(...parts)).href

describe('allowPrintRequest', () => {
  it('lets files in the allowed folders and their subfolders load', () => {
    expect(allowPrintRequest(file(root, 'work', 'document.html'), folders)).toBe(true)
    expect(allowPrintRequest(file(root, 'book', 'img', 'a.png'), folders)).toBe(true)
  })

  it('lets inline data load', () => {
    expect(allowPrintRequest('data:image/png;base64,AAAA', folders)).toBe(true)
  })

  it('blocks files outside the allowed folders, including by dot segments and sibling names', () => {
    expect(allowPrintRequest(file(other, 'secret.png'), folders)).toBe(false)
    expect(allowPrintRequest(`${file(root, 'book')}/../../private/secret.png`, folders)).toBe(false)
    expect(allowPrintRequest(`${file(root, 'book')}/%2e%2e/%2e%2e/private/secret.png`, folders)).toBe(false)
    expect(allowPrintRequest(file(root, 'bookshelf', 'a.png'), folders)).toBe(false)
  })

  it('blocks network, shared-drive, script and unparseable URLs', () => {
    for (const url of ['http://127.0.0.1:9/beacon.png', 'https://example.com/a.css', 'ftp://example.com/a', 'file://server/share/a.png', 'javascript:alert(1)', 'blob:null/1', 'not a url', '']) {
      expect(allowPrintRequest(url, folders), url).toBe(false)
    }
  })
})
