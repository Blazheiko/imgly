import { appError, err, type AppError, type Result } from '@/core'
import type { Capabilities, DecodedImage, DecodeMessage, DecodeRequest } from './types'

export interface WorkerDeps {
  probe(): Promise<Capabilities>
  decode(file: Blob, capabilities: Capabilities): Promise<Result<DecodedImage, AppError>>
  post(message: DecodeMessage, transfer?: Transferable[]): void
}

/**
 * The decode worker's body: probe once per session, decode, post one message. Any rejection is
 * posted as DECODE_FAILED, because an unhandled rejection in a worker never reaches the client's
 * `onerror` and would leave the open waiting forever.
 */
export async function handleDecodeRequest(
  request: DecodeRequest,
  deps: WorkerDeps,
): Promise<DecodeMessage> {
  let message: DecodeMessage
  try {
    const probed = request.capabilities ? undefined : await deps.probe()
    const result = await deps.decode(request.file, request.capabilities ?? probed!)
    message = probed ? { ...result, capabilities: probed } : result
  } catch {
    message = err(appError('DECODE_FAILED'))
  }
  if (message.ok) deps.post(message, [message.value.bitmap])
  else deps.post(message)
  return message
}
