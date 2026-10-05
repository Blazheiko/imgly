import { createDecoder } from './client'

export { createDecoder, parseWorkerResponse } from './client'
export { mapReadError } from './errors'
export * from './types'

/** Decodes a chosen or dropped file into an Original in a dedicated worker (feature ADR 0001). */
export const decodeImage = createDecoder(
  () => new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' }),
)
