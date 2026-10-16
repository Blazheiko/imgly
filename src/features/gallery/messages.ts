import { GALLERY_CAP } from '@/core'

/** The one catalog of user-facing Gallery copy (gallery screens.md §Message catalog). */

export type UnavailableReason = 'refused' | 'held' | 'newer-version'

export function failureWorkDamaged(name: string): string {
  return `“${name}” can't be opened: its stored data is damaged.`
}

/** The stored parts couldn't be read; that says nothing about the Work, so no Delete. AC-08 */
export function failureCouldNotOpen(name: string): string {
  return `“${name}” couldn't be opened. Try again.`
}

/** This build's codec worker is gone after a newer build replaced it (pwa-install-update AC-14). */
export function failurePartUnavailable(): string {
  return 'imgly was updated in another window. Reload this window to continue.'
}

/** The list couldn't be read; the Gallery keeps what it showed. AC-03 */
export function failureCouldNotList(): string {
  return "The Gallery couldn't be read. Try again."
}

export function failureCouldNotDelete(name: string): string {
  return `“${name}” couldn't be deleted. Try again.`
}

export function damagedNoticeAction(): string {
  return 'Delete…'
}

export function hintToolOpen(): string {
  return 'Apply or cancel the open tool first.'
}

export function hintOpenWorkCannotBeDeleted(): string {
  return "The open Work can't be deleted. Open another image first."
}

export function hintChooseWhileExporting(): string {
  return 'Wait for the export to finish, then choose a Work.'
}

export function hintChooseWhileConfirming(): string {
  return 'Answer the open question first, then choose a Work.'
}

export function storageLinePersisted(): string {
  return 'Works are kept in this browser. Export a Work to keep a copy elsewhere.'
}

export function storageLineNotPersisted(): string {
  return 'Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy.'
}

export function countLabel(n: number): string {
  return `${n} of ${GALLERY_CAP} places used`
}

export function statusOpen(): string {
  return 'Open'
}

export function statusDamaged(): string {
  return 'Damaged'
}

export function damagedThumbnail(): string {
  return "Can't be read"
}

export function emptyState(): string {
  return 'Works you open will appear here.'
}

export function unavailableTitle(): string {
  return 'The Gallery is unavailable in this window.'
}

export function unavailableBody(reason: UnavailableReason): string {
  switch (reason) {
    case 'refused':
      return "This browser isn't letting the editor keep anything for this site, for example because site data is blocked. You can still open, edit and export images, but nothing is kept after this page closes."
    case 'held':
      return 'Another tab of the editor is holding the Gallery. Close the other tabs of the editor, then reload this page.'
    case 'newer-version':
      return 'A newer version of the editor is open in another tab. Reload this page to use the Gallery.'
  }
}

export function deleteDialogTitle(name: string): string {
  return `Delete “${name}”?`
}

export function deleteDialogBody(): string {
  return "It can't be brought back. An Export is the only copy kept outside this browser."
}

export function deleteDialogCancel(): string {
  return 'Cancel'
}

export function deleteDialogConfirm(): string {
  return 'Delete'
}

export function reopeningLabel(name: string): string {
  return `Opening ${name}`
}

export function galleryButton(): string {
  return 'Gallery'
}

export function closeButton(): string {
  return 'Close'
}

export function closeTooltip(): string {
  return 'Close (Esc)'
}

export function deleteButton(): string {
  return 'Delete'
}

export function deleteButtonName(name: string): string {
  return `Delete “${name}”`
}
