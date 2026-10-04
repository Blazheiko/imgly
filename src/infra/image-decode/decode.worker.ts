/// <reference lib="webworker" />
import { browserEnv, runDecode } from './pipeline'
import { runProbes } from './probes'
import type { DecodeRequest } from './types'
import { handleDecodeRequest } from './worker-handler'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const started = performance.now()
  const message = await handleDecodeRequest(event.data, {
    probe: () => runProbes(browserEnv),
    decode: (file, capabilities) => runDecode(file, browserEnv, capabilities),
    post: (data, transfer) => scope.postMessage(data, transfer ?? []),
  })
  if (import.meta.env.DEV) {
    // Stage timing only — never a file name, pixels or metadata (sad.md §8 Privacy).
    console.debug(
      `[decode] ${message.ok ? 'ok' : message.error.code} in ${Math.round(performance.now() - started)} ms`,
    )
  }
}
