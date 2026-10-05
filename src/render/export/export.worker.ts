/// <reference lib="webworker" />
import { browserExportEnv, handleExport, type ExportRequest } from './worker-handler'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<ExportRequest>) => {
  const started = performance.now()
  const result = await handleExport(event.data, browserExportEnv)
  if (import.meta.env.DEV) {
    // Stage timing only — never a file name, pixels or metadata (sad.md §8 Privacy).
    console.debug(
      `[export] ${result.ok ? 'ok' : result.error.code} in ${Math.round(performance.now() - started)} ms`,
    )
  }
  scope.postMessage(result)
}
