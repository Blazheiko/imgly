/// <reference lib="webworker" />
import { handleCodecRequest, type CodecRequest } from './worker-handler'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<CodecRequest>) =>
  handleCodecRequest(event.data, {
    createCanvas: (width, height) => new OffscreenCanvas(width, height),
    createBitmap: (blob, options) => createImageBitmap(blob, options),
    post: (message, transfer) => scope.postMessage(message, transfer ?? []),
  })
