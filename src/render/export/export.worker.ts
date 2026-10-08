/// <reference lib="webworker" />
import {
  browserExportEnv,
  handleAlpha,
  handleCheck,
  handleExport,
  type ExportWorkerMessage,
} from './worker-handler'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
  const message = event.data
  if (message.kind === 'check') {
    scope.postMessage(await handleCheck(browserExportEnv))
    return
  }
  if (message.kind === 'alpha') {
    scope.postMessage(await handleAlpha(message.request, browserExportEnv))
    return
  }
  const started = performance.now()
  const result = await handleExport(message.request, browserExportEnv)
  if (import.meta.env.DEV) {
    // Stage timing only — never a file name, pixels or metadata (sad.md §8 Privacy).
    console.debug(
      `[export] ${result.ok ? 'ok' : result.error.code} in ${Math.round(performance.now() - started)} ms`,
    )
  }
  scope.postMessage(result)
}
