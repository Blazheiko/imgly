/**
 * Bounds-checked reads over untrusted bytes: every function returns `undefined` past the end
 * instead of throwing or reading garbage.
 */

export function u8(b: Uint8Array, o: number): number | undefined {
  return o >= 0 && o < b.length ? b[o] : undefined
}

export function u16(b: Uint8Array, o: number, littleEndian = false): number | undefined {
  if (o < 0 || o + 2 > b.length) return undefined
  const x = b[o]!
  const y = b[o + 1]!
  return littleEndian ? x | (y << 8) : (x << 8) | y
}

export function u32(b: Uint8Array, o: number, littleEndian = false): number | undefined {
  if (o < 0 || o + 4 > b.length) return undefined
  const [w, x, y, z] = [b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!]
  return littleEndian
    ? (w | (x << 8) | (y << 16) | (z << 24)) >>> 0
    : ((w << 24) | (x << 16) | (y << 8) | z) >>> 0
}

/** Reads `length` bytes as Latin-1 text; `undefined` if they aren't all inside the buffer. */
export function ascii(b: Uint8Array, o: number, length: number): string | undefined {
  if (o < 0 || o + length > b.length) return undefined
  let s = ''
  for (let i = o; i < o + length; i++) s += String.fromCharCode(b[i]!)
  return s
}

/** True when `b` holds exactly `expected` (bytes or Latin-1 text) at offset `o`. */
export function matches(b: Uint8Array, o: number, expected: string | readonly number[]): boolean {
  if (o < 0 || o + expected.length > b.length) return false
  for (let i = 0; i < expected.length; i++) {
    const want = typeof expected === 'string' ? expected.charCodeAt(i) : expected[i]
    if (b[o + i] !== want) return false
  }
  return true
}
