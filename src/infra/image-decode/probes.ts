import type { DecodeEnv } from './pipeline'
import { DECODE_OPTIONS } from './pipeline'
import type { Capabilities } from './types'

/**
 * A 2×1 px JPEG tagged with EXIF orientation 6 (305 B). A browser that applies orientation
 * decodes it as 1×2. Generated with:
 *   magick -size 2x1 xc:'#ff0000' -strip -quality 50 probe.jpg
 * then an APP1 Exif segment (big-endian TIFF, IFD0 with tag 0x0112 = 6) inserted after SOI.
 */
export const ORIENTATION_PROBE = {
  type: 'image/jpeg',
  base64:
    '/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR' +
    '0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2Nj' +
    'Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQ' +
    'AAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEA' +
    'AAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCKALXj/9k=',
}

/**
 * An 8×8 px HEIC (456 B); decoding it tells whether this browser opens HEIC/HEIF. Generated with:
 *   magick -size 8x8 xc:'#00ff00' probe.png && heif-enc -q 10 probe.png -o probe.heic
 */
export const HEIC_PROBE = {
  type: 'image/heic',
  base64:
    'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAX1tZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAA' +
    'AAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAGhAAEAAAAAAAAAJwAAACNpaW5mAAAAAAAB' +
    'AAAAFWluZmUCAAAAAAEAAGh2YzEAAAAA/WlwcnAAAADdaXBjbwAAAHZodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADw' +
    'NgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAA' +
    'AAMAgAAAAwCEYgABAAZEAcFzwYkAAAATY29scm5jbHgAAQANAAaAAAAAFGlzcGUAAAAAAAAAQAAAAEAAAAAoY2xhcA' +
    'AAAAgAAAABAAAACAAAAAH////IAAAAAv///8gAAAACAAAAEHBpeGkAAAAAAwgICAAAABhpcG1hAAAAAAAAAAEAAQWB' +
    'AgMFhAAAAC9tZGF0AAAAIygBrwQSE4zg+OnCaAsmf/kiL58DyftAqyvjSZ93sRiSqf+g',
}

export function probeBlob(probe: { type: string; base64: string }): Blob {
  const binary = atob(probe.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: probe.type })
}

/**
 * Runs once per session, in the first worker; the samples are embedded, so nothing is fetched.
 * A throwing orientation probe counts as "applies it" (every target engine does today); a
 * throwing HEIC probe counts as unsupported.
 */
export async function runProbes(env: DecodeEnv): Promise<Capabilities> {
  const [appliesOrientation, decodesHeic] = await Promise.all([
    decodeSize(env, ORIENTATION_PROBE).then(
      (size) => !size || (size.width === 1 && size.height === 2),
    ),
    decodeSize(env, HEIC_PROBE).then((size) => size !== undefined),
  ])
  return { appliesOrientation, decodesHeic }
}

async function decodeSize(
  env: DecodeEnv,
  probe: { type: string; base64: string },
): Promise<{ width: number; height: number } | undefined> {
  try {
    const bitmap = await env.createImageBitmap(probeBlob(probe), DECODE_OPTIONS)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return undefined
  }
}
