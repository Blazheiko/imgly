import { createExportClient } from './client'
import { browserExportEnv, handleCheck, handleExport, type ExportEnv } from './worker-handler'

export { createExportClient, type FormatAvailabilityCheck, type InWindowExport } from './client'
export {
  handleCheck,
  handleExport,
  type ExportEnv,
  type ExportRequest,
  type FormatCheck,
} from './worker-handler'

/** The worker's path run in the window, rendering on a DOM canvas (export ADR-0003). */
const inWindowEnv: ExportEnv = {
  ...browserExportEnv,
  createRenderCanvas: (width, height) =>
    Object.assign(document.createElement('canvas'), { width, height }),
}

/** One export or format check in a short-lived worker (export ADR-0002), else in the window. */
export const { exportImage, checkExportFormats } = createExportClient(
  () => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }),
  {
    exportImage: (request) => handleExport(request, inWindowEnv),
    check: () => handleCheck(inWindowEnv),
  },
)
