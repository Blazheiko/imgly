import {
  appError,
  checkOpenPolicy,
  err,
  HEADER_WINDOW_BYTES,
  ok,
  reductionSteps,
  sniffImageHeader,
  targetSize,
  type AppError,
  type Result,
} from '@/core'
import { errorName, mapReadError } from './errors'
import type { DecodedImage } from './types'

/** The browser APIs the pipeline needs, injected so it runs under unit tests too. */
export interface DecodeEnv {
  createImageBitmap(source: Blob, options: ImageBitmapOptions): Promise<ImageBitmap>
  createCanvas(width: number, height: number): OffscreenCanvas
}

export const browserEnv: DecodeEnv = {
  createImageBitmap: (source, options) => createImageBitmap(source, options),
  createCanvas: (width, height) => new OffscreenCanvas(width, height),
}

const DECODE_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'default', // sRGB (feature ADR 0004)
}

/**
 * header window → sniff → open policy → decode → stepwise reduction (feature ADR 0001). The
 * ceiling is checked from the declared size before any pixel is decoded (AC-09).
 */
export async function runDecode(
  file: Blob,
  env: DecodeEnv,
): Promise<Result<DecodedImage, AppError>> {
  let window: Uint8Array
  try {
    window = new Uint8Array(await file.slice(0, HEADER_WINDOW_BYTES).arrayBuffer())
  } catch (error) {
    return err(appError(mapReadError(errorName(error))))
  }

  const sniffed = sniffImageHeader(window)
  if (!sniffed.ok) return sniffed
  const allowed = checkOpenPolicy(sniffed.value)
  if (!allowed.ok) return allowed
  const header = allowed.value

  let decoded: ImageBitmap
  try {
    decoded = await env.createImageBitmap(file, DECODE_OPTIONS)
  } catch (error) {
    return err(appError(mapReadError(errorName(error))))
  }

  const source = { width: decoded.width, height: decoded.height }
  const target = targetSize(source.width, source.height)
  const reduced = reduce(decoded, reductionSteps(source, target), env)
  if (!reduced) return err(appError('DECODE_FAILED'))

  return ok({
    bitmap: reduced,
    sourceWidth: source.width,
    sourceHeight: source.height,
    width: reduced.width,
    height: reduced.height,
    format: header.format,
    animated: header.animated,
    downscaled: target.downscaled,
  })
}

/** Draws through each step with high-quality smoothing, closing every intermediate bitmap. */
function reduce(
  start: ImageBitmap,
  steps: { width: number; height: number }[],
  env: DecodeEnv,
): ImageBitmap | undefined {
  let current = start
  try {
    for (const step of steps) {
      const canvas = env.createCanvas(step.width, step.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(current, 0, 0, step.width, step.height)
      const next = canvas.transferToImageBitmap()
      current.close()
      current = next
    }
    return current
  } catch {
    current.close()
    return undefined
  }
}
