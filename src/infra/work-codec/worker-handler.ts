import type { AppErrorCode } from '@/core'
import type { ReadPng } from './png-decode'

/** The size a stored PNG must decode to. */
export interface PixelSize {
  width: number
  height: number
}

/** The one message type shared by `client.ts` and the worker: the contract. */
export type CodecRequest =
  { kind: 'encode'; bitmap: ImageBitmap } | { kind: 'decode'; blob: Blob; expected: PixelSize }

export type CodecReply =
  { ok: true; value: Blob | ImageBitmap } | { ok: false; error: { code: AppErrorCode } }

export interface CodecDeps {
  createCanvas(width: number, height: number): OffscreenCanvas
  createBitmap(blob: Blob, options: ImageBitmapOptions): Promise<ImageBitmap>
  /** A PNG the app wrote, as straight RGBA, without the browser's decoder (`png-decode.ts`). */
  readRgbaPng(blob: Blob): Promise<ReadPng>
  /** Straight RGBA to PNG, byte for byte (`png-encode.ts`); never a canvas encoder. */
  encodePng(width: number, height: number, rgba: Uint8Array): Promise<Blob>
  post(message: CodecReply, transfer?: Transferable[]): void
}

/** Encodes a bitmap to PNG or decodes a PNG with the size check; always posts one reply. */
export async function handleCodecRequest(request: CodecRequest, deps: CodecDeps): Promise<void> {
  const fail = (code: AppErrorCode) => deps.post({ ok: false, error: { code } })

  if (request.kind === 'encode') {
    const { bitmap } = request
    try {
      const canvas = deps.createCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('no 2d context')
      context.drawImage(bitmap, 0, 0)
      // The same straight readback the Export makes (export worker `readPixels`), stored as is:
      // the reopened Original then reads back to the very bytes the Export read before (QG-2).
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      const png = await deps.encodePng(bitmap.width, bitmap.height, new Uint8Array(data.buffer))
      deps.post({ ok: true, value: png })
    } catch {
      fail('STORAGE_FAILED')
    } finally {
      bitmap.close()
    }
    return
  }

  let read: ReadPng
  try {
    read = await deps.readRgbaPng(request.blob)
  } catch {
    read = 'damaged'
  }
  if (read === 'damaged') {
    fail('WORK_DAMAGED')
    return
  }
  if (read !== 'other') {
    if (read.width !== request.expected.width || read.height !== request.expected.height) {
      fail('WORK_DAMAGED')
      return
    }
    // putImageData premultiplies with the rounding getImageData undoes, so the bitmap reads back
    // to the stored bytes on every engine, and draws into the layer canvas unchanged (QG-2).
    let bitmap: ImageBitmap
    try {
      const canvas = deps.createCanvas(read.width, read.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no 2d context')
      const pixels = new Uint8ClampedArray(read.rgba.buffer, read.rgba.byteOffset, read.rgba.length)
      context.putImageData(new ImageData(pixels, read.width, read.height), 0, 0)
      bitmap = canvas.transferToImageBitmap()
    } catch {
      fail('WORK_DAMAGED')
      return
    }
    deps.post({ ok: true, value: bitmap }, [bitmap])
    return
  }

  // A PNG of another shape, not written by `encodeRgbaPng`: the browser decodes it.
  let decoded: ImageBitmap
  try {
    decoded = await deps.createBitmap(request.blob, {
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
    })
  } catch {
    fail('WORK_DAMAGED')
    return
  }
  if (decoded.width !== request.expected.width || decoded.height !== request.expected.height) {
    decoded.close()
    fail('WORK_DAMAGED')
    return
  }
  deps.post({ ok: true, value: decoded }, [decoded])
}
