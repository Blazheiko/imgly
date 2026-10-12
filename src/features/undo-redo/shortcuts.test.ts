import { describe, expect, it, vi } from 'vitest'
import {
  INFO_EXPORTING,
  INFO_TOOL_OPEN,
  LABEL_REDO,
  LABEL_UNDO,
  redoHint,
  undoHint,
} from './messages'
import { createUndoRedoShortcuts, type UndoRedoShortcutActions } from './shortcuts'

function actions(over: Partial<UndoRedoShortcutActions> = {}) {
  return {
    hasWork: () => true,
    confirming: () => false,
    exporting: () => false,
    toolOpen: () => false,
    canUndo: () => true,
    canRedo: () => true,
    undo: vi.fn(),
    redo: vi.fn(),
    notifyToolOpen: vi.fn(),
    notifyExporting: vi.fn(),
    ...over,
  }
}

type Keys = Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'repeat'>>

function key(k: string, mods: Keys & { code?: string } = {}, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...mods })
  if (target) Object.defineProperty(event, 'target', { value: target })
  return event
}

function press(a: ReturnType<typeof actions>, event: KeyboardEvent) {
  createUndoRedoShortcuts(a)(event)
  return event
}

describe('undo-redo messages (screens.md §Message catalog)', () => {
  it('names the buttons and their hints verbatim', () => {
    expect(LABEL_UNDO).toBe('Undo')
    expect(LABEL_REDO).toBe('Redo')
    expect(undoHint('adjust')).toBe('Undo Adjust (Ctrl/Cmd+Z)')
    expect(undoHint('crop-rotate')).toBe('Undo Crop and rotate (Ctrl/Cmd+Z)')
    expect(redoHint('draw')).toBe('Redo Draw (Shift+Ctrl/Cmd+Z)')
    expect(undoHint(null)).toBe('Nothing to undo')
    expect(redoHint(null)).toBe('Nothing to redo')
    expect(INFO_TOOL_OPEN).toBe('Apply or cancel the open tool first.')
    expect(INFO_EXPORTING).toBe('An export is in progress. Undo and Redo work again when it ends.')
  })
})

describe('undo-redo shortcuts (screens.md §Keyboard)', () => {
  it('undoes on Ctrl+Z and Cmd+Z, preventing the browser’s default (AC-01, AC-14)', () => {
    for (const mods of [{ ctrlKey: true }, { metaKey: true }]) {
      const a = actions()
      expect(press(a, key('z', mods)).defaultPrevented).toBe(true)
      expect(a.undo).toHaveBeenCalledOnce()
      expect(a.redo).not.toHaveBeenCalled()
    }
  })

  it('redoes on Shift+Ctrl+Z, Shift+Cmd+Z and Ctrl+Y (AC-02)', () => {
    for (const [k, mods] of [
      ['Z', { ctrlKey: true, shiftKey: true }],
      ['Z', { metaKey: true, shiftKey: true }],
      ['y', { ctrlKey: true }],
    ] as const) {
      const a = actions()
      expect(press(a, key(k, mods)).defaultPrevented).toBe(true)
      expect(a.redo).toHaveBeenCalledOnce()
      expect(a.undo).not.toHaveBeenCalled()
    }
  })

  it('works by key position on a layout that types no Latin letter there (AC-14)', () => {
    const a = actions()
    expect(press(a, key('я', { ctrlKey: true, code: 'KeyZ' })).defaultPrevented).toBe(true)
    expect(a.undo).toHaveBeenCalledOnce()
    press(a, key('Я', { metaKey: true, shiftKey: true, code: 'KeyZ' }))
    press(a, key('н', { ctrlKey: true, code: 'KeyY' }))
    expect(a.redo).toHaveBeenCalledTimes(2)
  })

  it('follows the letter a Latin layout types, not its position', () => {
    // German QWERTZ: the KeyZ position types y, so Ctrl there is Redo, not Undo.
    const a = actions()
    press(a, key('y', { ctrlKey: true, code: 'KeyZ' }))
    expect(a.redo).toHaveBeenCalledOnce()
    expect(a.undo).not.toHaveBeenCalled()
  })

  it('never handles Cmd+Y, which stays the browser’s', () => {
    const a = actions()
    expect(press(a, key('y', { metaKey: true })).defaultPrevented).toBe(false)
    expect(a.redo).not.toHaveBeenCalled()
  })

  it('does not handle Alt combinations or a plain Z', () => {
    const a = actions()
    for (const event of [
      key('z', { ctrlKey: true, altKey: true }),
      key('Z', { ctrlKey: true, shiftKey: true, altKey: true }),
      key('z'),
      key('y', { ctrlKey: true, shiftKey: true }),
    ]) {
      expect(press(a, event).defaultPrevented).toBe(false)
    }
    expect(a.undo).not.toHaveBeenCalled()
    expect(a.redo).not.toHaveBeenCalled()
  })

  it('leaves a focused text or number field its own undo (AC-08, AC-14)', () => {
    const field = document.createElement('input')
    field.type = 'number'
    const a = actions()
    expect(press(a, key('z', { ctrlKey: true }, field)).defaultPrevented).toBe(false)
    expect(press(a, key('y', { ctrlKey: true }, field)).defaultPrevented).toBe(false)
    expect(a.undo).not.toHaveBeenCalled()
    expect(a.redo).not.toHaveBeenCalled()
  })

  it('ignores a held key’s repeats, so one press undoes one Step', () => {
    const a = actions()
    const event = press(a, key('z', { ctrlKey: true, repeat: true }))
    expect(event.defaultPrevented).toBe(true)
    expect(a.undo).not.toHaveBeenCalled()
  })

  it('does nothing, without a notice, when there is nothing to undo or redo (AC-05)', () => {
    const a = actions({ canUndo: () => false, canRedo: () => false })
    press(a, key('z', { ctrlKey: true }))
    press(a, key('y', { ctrlKey: true }))
    expect(a.undo).not.toHaveBeenCalled()
    expect(a.redo).not.toHaveBeenCalled()
    expect(a.notifyToolOpen).not.toHaveBeenCalled()
    expect(a.notifyExporting).not.toHaveBeenCalled()
  })

  it('does nothing with no Work open or with the replace dialog open', () => {
    for (const over of [{ hasWork: () => false }, { confirming: () => true }]) {
      const a = actions({ ...over, toolOpen: () => true, exporting: () => true })
      press(a, key('z', { ctrlKey: true }))
      expect(a.undo).not.toHaveBeenCalled()
      expect(a.notifyToolOpen).not.toHaveBeenCalled()
      expect(a.notifyExporting).not.toHaveBeenCalled()
    }
  })

  it('shows the export notice during an export, refused not queued (AC-07)', () => {
    const a = actions({ exporting: () => true, toolOpen: () => true })
    press(a, key('z', { metaKey: true }))
    press(a, key('Z', { metaKey: true, shiftKey: true }))
    expect(a.notifyExporting).toHaveBeenCalledTimes(2)
    expect(a.notifyToolOpen).not.toHaveBeenCalled()
    expect(a.undo).not.toHaveBeenCalled()
    expect(a.redo).not.toHaveBeenCalled()
  })

  it('shows the tool-open notice while a tool is open (AC-08)', () => {
    const a = actions({ toolOpen: () => true })
    press(a, key('z', { ctrlKey: true }))
    press(a, key('y', { ctrlKey: true }))
    expect(a.notifyToolOpen).toHaveBeenCalledTimes(2)
    expect(a.undo).not.toHaveBeenCalled()
    expect(a.redo).not.toHaveBeenCalled()
  })
})
