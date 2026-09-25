// Which bytes a non-ASCII password must be for pdf.js to open an RC4 128-bit (R3) PDF, the kind pdf.protect makes.
// The PDF is encrypted here by the spec's own algorithms (ISO 32000-1, 7.6.3), so no Ghostscript is needed.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { passwordToken } from '../../src/pdf/ghostscript'

const PAD = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex')
const md5 = (...parts: Buffer[]) => createHash('md5').update(Buffer.concat(parts)).digest()

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255
    ;[s[i], s[j]] = [s[j]!, s[i]!]
  }
  const out = Buffer.alloc(data.length)
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255
    j = (j + s[i]!) & 255
    ;[s[i], s[j]] = [s[j]!, s[i]!]
    out[n] = data[n]! ^ s[(s[i]! + s[j]!) & 255]!
  }
  return out
}

const padded = (pw: Buffer) => Buffer.concat([pw, PAD]).subarray(0, 32)
const rounds19 = (key: Buffer, data: Buffer) => {
  let d = rc4(key, data)
  for (let i = 1; i <= 19; i++) d = rc4(Buffer.from(key.map((b) => b ^ i)), d)
  return d
}

/** A one-page PDF encrypted with R3, 128-bit RC4, whose user password is exactly `userBytes`. */
function encryptedPdf(userBytes: Buffer): Uint8Array {
  const id = Buffer.from('0123456789abcdef0123456789abcdef', 'hex')
  const P = -3904
  let h = md5(padded(Buffer.from('owner')))
  for (let i = 0; i < 50; i++) h = md5(h)
  const O = rounds19(h.subarray(0, 16), padded(userBytes))
  const p = Buffer.alloc(4)
  p.writeInt32LE(P)
  let k = md5(padded(userBytes), O, p, id)
  for (let i = 0; i < 50; i++) k = md5(k.subarray(0, 16))
  const key = k.subarray(0, 16)
  const U = Buffer.concat([rounds19(key, md5(PAD, id)), Buffer.alloc(16)])
  const content = Buffer.from('0 0 10 10 re f')
  const objKey = md5(key, Buffer.from([4, 0, 0, 0, 0])).subarray(0, 16)
  const stream = rc4(objKey, content)

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>',
    null,
    `<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${O.toString('hex')}> /U <${U.toString('hex')}> /P ${P} >>`,
  ]
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')]
  const offsets: number[] = []
  let at = parts[0]!.length
  objs.forEach((body, i) => {
    offsets.push(at)
    const chunk =
      body === null
        ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from('\nendstream\nendobj\n')])
        : Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`)
    parts.push(chunk)
    at += chunk.length
  })
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 5 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>\nstartxref\n${at}\n%%EOF\n`
  parts.push(Buffer.from(xref + trailer))
  return new Uint8Array(Buffer.concat(parts))
}

async function opens(data: Uint8Array, password: string): Promise<boolean> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data, password, verbosity: 0 })
  try {
    return (await task.promise).numPages === 1
  } catch {
    return false
  } finally {
    await task.destroy()
  }
}

describe('non-ASCII PDF passwords', () => {
  it('open in pdf.js when written as Latin-1 bytes, and not as UTF-8', async () => {
    const latin1 = Buffer.from(passwordToken('café').slice(1, -1), 'hex')
    expect(await opens(encryptedPdf(latin1), 'café')).toBe(true)
    expect(await opens(encryptedPdf(latin1), 'cafe')).toBe(false)
    // What Ghostscript would have been given through -sUserPassword=café in a UTF-8 argfile.
    expect(await opens(encryptedPdf(Buffer.from('café', 'utf8')), 'café')).toBe(false)
  })
})
