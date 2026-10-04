/// <reference lib="webworker" />
import { browserEnv, runDecode } from './pipeline'
import { runProbes } from './probes'
import type { DecodeMessage, DecodeRequest } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const started = performance.now()
  const probed = event.data.capabilities ? undefined : await runProbes(browserEnv)
  const capabilities = event.data.capabilities ?? probed!
  const result = await runDecode(event.data.file, browserEnv, capabilities)
  const message: DecodeMessage = probed ? { ...result, capabilities: probed } : result
  if (import.meta.env.DEV) {
    // Stage timing only — never a file name, pixels or metadata (sad.md §8 Privacy).
    console.debug(
      `[decode] ${result.ok ? 'ok' : result.error.code} in ${Math.round(performance.now() - started)} ms`,
    )
  }
  if (result.ok) scope.postMessage(message, [result.value.bitmap])
  else scope.postMessage(message)
}
