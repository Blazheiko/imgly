/// <reference lib="webworker" />
import { browserEnv, runDecode } from './pipeline'
import type { DecodeRequest, DecodeResponse } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const started = performance.now()
  const result: DecodeResponse = await runDecode(event.data.file, browserEnv)
  if (import.meta.env.DEV) {
    // Stage timing only — never a file name, pixels or metadata (sad.md §8 Privacy).
    console.debug(
      `[decode] ${result.ok ? 'ok' : result.error.code} in ${Math.round(performance.now() - started)} ms`,
    )
  }
  if (result.ok) scope.postMessage(result, [result.value.bitmap])
  else scope.postMessage(result)
}
