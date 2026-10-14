import { createWorkCodec } from './client'

export { createWorkCodec } from './client'
export type { CodecReply, CodecRequest, PixelSize } from './worker-handler'

/** Encodes and decodes the stored Original and Drawing layer as PNG in a fresh worker per job. */
export const workCodec = createWorkCodec(
  () => new Worker(new URL('./codec.worker.ts', import.meta.url), { type: 'module' }),
)
