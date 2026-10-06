import { createExportClient } from './client'

export { createExportClient, type FormatAvailabilityCheck } from './client'
export {
  handleCheck,
  handleExport,
  type ExportEnv,
  type ExportRequest,
  type FormatCheck,
} from './worker-handler'

/** One export or format check in a short-lived worker (export ADR-0002). */
export const { exportImage, checkExportFormats } = createExportClient(
  () => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }),
)
