// A multi-size Windows .ico written by hand: ICONDIR, one ICONDIRENTRY per size, then each frame as a PNG (Windows Vista and later read PNG frames).

export interface IcoFrame {
  /** Square edge in pixels. */
  size: number
  png: Buffer
}

const DIR_BYTES = 6
const ENTRY_BYTES = 16

export function encodeIco(frames: readonly IcoFrame[]): Buffer {
  const header = Buffer.alloc(DIR_BYTES + ENTRY_BYTES * frames.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach((f, i) => {
    const at = DIR_BYTES + ENTRY_BYTES * i
    // One byte per edge; 0 means 256 or more, and the PNG inside carries the real size.
    const edge = f.size >= 256 ? 0 : f.size
    header.writeUInt8(edge, at)
    header.writeUInt8(edge, at + 1)
    header.writeUInt8(0, at + 2)
    header.writeUInt8(0, at + 3)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(f.png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += f.png.length
  })
  return Buffer.concat([header, ...frames.map((f) => f.png)])
}
