import type { AppErrorCode } from '@/core'

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
  post(message: CodecReply, transfer?: Transferable[]): void
}

/** Encodes a bitmap to PNG or decodes a PNG with the size check; always posts one reply. */
export async function handleCodecRequest(request: CodecRequest, deps: CodecDeps): Promise<void> {
  const fail = (code: AppErrorCode) => deps.post({ ok: false, error: { code } })

  if (request.kind === 'encode') {
    const { bitmap } = request
    try {
      const canvas = deps.createCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no 2d context')
      context.drawImage(bitmap, 0, 0)
      const png = await canvas.convertToBlob({ type: 'image/png' })
      deps.post({ ok: true, value: png })
    } catch {
      fail('STORAGE_FAILED')
    } finally {
      bitmap.close()
    }
    return
  }

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
