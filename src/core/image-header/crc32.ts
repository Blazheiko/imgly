const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 (ISO 3309, as PNG uses) over `b[start, end)`. */
export function crc32(b: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let i = start; i < end; i++) crc = TABLE[(crc ^ b[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
