// A 24-bit BMP written by hand, since sharp has no BMP writer.

/** `rgb` is packed 3-channel pixels, top row first. */
export function encodeBmp(rgb: Buffer, width: number, height: number): Buffer {
  const rowBytes = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowBytes * height
  const out = Buffer.alloc(54 + pixelBytes)
  out.write('BM', 0, 'ascii')
  out.writeUInt32LE(out.length, 2)
  out.writeUInt32LE(54, 10)
  out.writeUInt32LE(40, 14)
  out.writeInt32LE(width, 18)
  out.writeInt32LE(height, 22)
  out.writeUInt16LE(1, 26)
  out.writeUInt16LE(24, 28)
  out.writeUInt32LE(0, 30)
  out.writeUInt32LE(pixelBytes, 34)
  // 2835 pixels per metre is 72 dpi.
  out.writeInt32LE(2835, 38)
  out.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    // Rows are stored bottom-up, pixels as BGR.
    const dst = 54 + (height - 1 - y) * rowBytes
    const src = y * width * 3
    for (let x = 0; x < width; x++) {
      const s = src + x * 3
      const d = dst + x * 3
      out[d] = rgb[s + 2]!
      out[d + 1] = rgb[s + 1]!
      out[d + 2] = rgb[s]!
    }
  }
  return out
}
