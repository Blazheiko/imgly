import { appError, err, ok, type AppError, type Result } from '@/core'

/** The smallest texture size that holds a full Original at the Downscale limit. */
const MIN_TEXTURE_SIZE = 4096
const WORKER_PROBE_TIMEOUT_MS = 3000

export interface CapabilityChecks {
  webgl2(): WebGL2RenderingContext | null
  hasCreateImageBitmap(): boolean
  workerCanvas2d(): Promise<boolean>
}

const WORKER_PROBE = `self.postMessage((() => {
  try { return typeof OffscreenCanvas === 'function' && !!new OffscreenCanvas(1, 1).getContext('2d') }
  catch { return false }
})())`

export const browserChecks: CapabilityChecks = {
  webgl2: () => document.createElement('canvas').getContext('webgl2'),
  hasCreateImageBitmap: () => typeof createImageBitmap === 'function',
  workerCanvas2d: () =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(new Blob([WORKER_PROBE], { type: 'text/javascript' }))
      const worker = new Worker(url)
      const done = (value: boolean) => {
        clearTimeout(timer)
        worker.terminate()
        URL.revokeObjectURL(url)
        resolve(value)
      }
      const timer = setTimeout(() => done(false), WORKER_PROBE_TIMEOUT_MS)
      worker.onmessage = (event) => done(event.data === true)
      worker.onerror = () => done(false)
    }),
}

/**
 * The start-up gate (feature ADR 0003): a WebGL2 context with MAX_TEXTURE_SIZE ≥ 4096,
 * `createImageBitmap`, and OffscreenCanvas 2D inside a worker. Runs once per page load and never
 * reads the user agent. Anything missing → UNSUPPORTED_BROWSER (AC-18, SCR-04).
 */
export async function probeCapabilities(
  checks: CapabilityChecks = browserChecks,
): Promise<Result<void, AppError>> {
  const unsupported = err(appError('UNSUPPORTED_BROWSER'))
  try {
    const gl = checks.webgl2()
    if (!gl) return unsupported
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    gl.getExtension('WEBGL_lose_context')?.loseContext() // free the probe context at once
    if (maxTexture < MIN_TEXTURE_SIZE) return unsupported
    if (!checks.hasCreateImageBitmap()) return unsupported
    if (!(await checks.workerCanvas2d())) return unsupported
    return ok(undefined)
  } catch {
    return unsupported
  }
}
