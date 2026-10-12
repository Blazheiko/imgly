import type { ToolId } from '@/features/editor'

/** The one catalog of user-facing copy for Undo and Redo (screens.md §Message catalog). */

export const LABEL_UNDO = 'Undo'
export const LABEL_REDO = 'Redo'

/** The `{tool}` value: the name of the tool whose Step Undo or Redo would take (AC-01). */
export const TOOL_NAMES: Record<ToolId, string> = {
  'crop-rotate': 'Crop and rotate',
  adjust: 'Adjust',
  draw: 'Draw',
}

/** The Undo button's hint: the Step it would take back, or that nothing is left (AC-05). */
export function undoHint(tool: ToolId | null): string {
  return tool ? `Undo ${TOOL_NAMES[tool]} (Ctrl/Cmd+Z)` : 'Nothing to undo'
}

/** The Redo button's hint: the Step it would restore, or that nothing is waiting (AC-04, AC-05). */
export function redoHint(tool: ToolId | null): string {
  return tool ? `Redo ${TOOL_NAMES[tool]} (Shift+Ctrl/Cmd+Z)` : 'Nothing to redo'
}

/** Tooltip and shortcut notice while a tool is open (AC-08). */
export const INFO_TOOL_OPEN = 'Apply or cancel the open tool first.'

/** Tooltip and shortcut notice during an export (AC-07). */
export const INFO_EXPORTING = 'An export is in progress. Undo and Redo work again when it ends.'
