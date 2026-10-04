import {
  appError,
  checkFileBytes,
  checkOpenPolicy,
  err,
  HEADER_WINDOW_BYTES,
  ok,
  reductionSteps,
  sniffImageHeader,
  targetSize,
  type AppError,
  type ExifOrientation,
  type Result,
  type Size,
} from '@/core'
import { errorName, mapReadError } from './errors'
import { orientationTransform, type CanvasMatrix } from './orient'
import type { Capabilities, DecodedImage } from './types'

/** The browser APIs the pipeline needs, injected so it runs under unit tests too. */
export interface DecodeEnv {
  createImageBitmap(source: Blob, options: ImageBitmapOptions): Promise<ImageBitmap>
  createCanvas(width: number, height: number): OffscreenCanvas
}

export const browserEnv: DecodeEnv = {
  createImageBitmap: (source, options) => createImageBitmap(source, options),
  createCanvas: (width, height) => new OffscreenCanvas(width, height),
}

export const DECODE_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'default', // sRGB (feature ADR 0004)
}

/**
 * byte ceiling → header window → sniff → open policy → decode → orient (if the browser didn't) → stepwise
 * reduction (feature ADR 0001). The ceiling is checked from the declared size before any pixel
 * is decoded (AC-09), and again on the decoded bitmap in case the header understated it. HEIC is
 * refused without decoding where the probe found no support.
 */
export async function runDecode(
  file: Blob,
  env: DecodeEnv,
  capabilities: Capabilities,
): Promise<Result<DecodedImage, AppError>> {
  const withinBytes = checkFileBytes(file.size)
  if (!withinBytes.ok) return withinBytes

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
  if (header.format === 'heic' && !capabilities.decodesHeic) {
    return err(appError('UNSUPPORTED_FORMAT', { format: 'HEIC' }))
  }

  let decoded: ImageBitmap
  try {
    decoded = await env.createImageBitmap(file, DECODE_OPTIONS)
  } catch (error) {
    return err(appError(mapReadError(errorName(error))))
  }
  const decodedAllowed = checkOpenPolicy({
    ...header,
    width: decoded.width,
    height: decoded.height,
  })
  if (!decodedAllowed.ok) {
    decoded.close()
    return decodedAllowed
  }

  const orientation = capabilities.appliesOrientation ? 1 : header.exifOrientation
  const upright = orientationFor(orientation, decoded)
  const source = { width: upright.width, height: upright.height }
  const target = targetSize(source.width, source.height)
  const steps = reductionSteps(source, target)
  if (upright.matrix && steps.length === 0)
    steps.push({ width: target.width, height: target.height })
  const reduced = reduce(decoded, steps, upright, env)
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

/** The upright size, and the transform to get there when the worker must orient (2–8). */
function orientationFor(
  orientation: ExifOrientation,
  stored: Size,
): Size & { matrix?: CanvasMatrix } {
  if (orientation === 1) return { width: stored.width, height: stored.height }
  return orientationTransform(orientation, stored.width, stored.height)
}

/**
 * Draws through each step with high-quality smoothing, closing every intermediate bitmap. The
 * first step also applies the orientation transform when the worker must orient.
 */
function reduce(
  start: ImageBitmap,
  steps: Size[],
  upright: Size & { matrix?: CanvasMatrix },
  env: DecodeEnv,
): ImageBitmap | undefined {
  let current = start
  try {
    for (const [i, step] of steps.entries()) {
      const canvas = env.createCanvas(step.width, step.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      if (i === 0 && upright.matrix) {
        ctx.setTransform(step.width / upright.width, 0, 0, step.height / upright.height, 0, 0)
        ctx.transform(...upright.matrix)
        ctx.drawImage(current, 0, 0)
      } else {
        ctx.drawImage(current, 0, 0, step.width, step.height)
      }
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
