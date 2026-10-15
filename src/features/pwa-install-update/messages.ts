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

/** The first time the app is stored for offline use (AC-05). */
export function infoOfflineReady(): string {
  return 'imgly is ready to work offline.'
}
