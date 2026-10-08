import { createExportClient } from './client'
import { browserExportEnv, handleAlpha, handleCheck, handleExport } from './worker-handler'

export { createExportClient, type FormatAvailabilityCheck, type InWindowExport } from './client'
export {
  handleAlpha,
  handleCheck,
  handleExport,
  type AlphaRequest,
  type ExportEnv,
  type ExportRequest,
  type FormatCheck,
} from './worker-handler'

/**
 * One export or format check in a short-lived worker (export ADR-0002), else the same code in the
 * window on an `OffscreenCanvas` there (export ADR-0003).
 */
export const { exportImage, checkExportFormats, checkCropTransparency } = createExportClient(
  () => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }),
  {
    exportImage: (request) => handleExport(request, browserExportEnv),
    check: () => handleCheck(browserExportEnv),
    checkAlpha: (request) => handleAlpha(request, browserExportEnv),
  },
)
