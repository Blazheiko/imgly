/** The one catalog of this feature's copy (screens.md §Message catalog). */

export type UpdateWording = 'available' | 'updated-elsewhere' | 'reload-to-save'

/** The update notice's three wordings (SCR-05, AC-06, AC-14). */
export const UPDATE_TEXT: Record<UpdateWording, string> = {
  available: 'A new version of imgly is available.',
  'updated-elsewhere': 'imgly was updated in another window. Reload to use the new version.',
  'reload-to-save':
    'imgly was updated in another window. Reload this window to keep saving to the Gallery.',
}

export const ACTION_RELOAD = 'Reload'
/** The busy action while Reload waits for a save, or reloads (AC-07, AC-11). */
export const ACTION_RELOADING = 'Reloading…'

/** The first time the app is stored for offline use (AC-05). */
export function infoOfflineReady(): string {
  return 'imgly is ready to work offline.'
}

/** Reload refused while a tool is open with its Draft (AC-10). */
export function failureToolOpen(): string {
  return 'Apply or cancel the open tool first.'
}

/** Reload refused while an Export runs (AC-13). */
export function failureExportRunning(): string {
  return 'Wait for the export to finish, then reload.'
}

/** The Work to reopen after the update is no longer in the Gallery (AC-08). */
export function failureReopenEvicted(): string {
  return "The image you had open couldn't be reopened: it was removed from the Gallery to make room."
}

/** The Work to reopen after the update can't be read, or the Gallery is unavailable (AC-08). */
export function failureReopenUnreadable(): string {
  return "The image you had open couldn't be reopened. Open it from the Gallery if it's there."
}
