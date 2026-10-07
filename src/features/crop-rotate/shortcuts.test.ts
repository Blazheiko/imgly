import { describe, expect, it, vi } from 'vitest'
import { createOpenShortcut, createToolKeys, type OpenShortcutActions } from './shortcuts'

function setup(
  state: Partial<Record<'hasWork' | 'exporting' | 'panelOpen' | 'toolOpen', boolean>> = {},
) {
  const actions: OpenShortcutActions = {
    hasWork: () => state.hasWork ?? true,
    exporting: () => state.exporting ?? false,
    panelOpen: () => state.panelOpen ?? false,
    toolOpen: () => state.toolOpen ?? false,
    open: vi.fn(),
    notifyNoImage: vi.fn(),
  }
  return { actions, handle: createOpenShortcut(actions) }
}

const key = (init: KeyboardEventInit & { target?: EventTarget } = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'c', cancelable: true, ...init })
  if (init.target) Object.defineProperty(event, 'target', { value: init.target })
  return event
}

describe('the C shortcut (AC-18, AC-20)', () => {
  it('opens the tool with c or C', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ key: 'C', shiftKey: true }))
    expect(actions.open).toHaveBeenCalledTimes(2)
  })

  it('shows the "open an image first" hint with no Work', () => {
    const { actions, handle } = setup({ hasWork: false })
    handle(key())
    expect(actions.notifyNoImage).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it.each([
    ['an export is running (AC-15)', { exporting: true }],
    ['the export panel is open', { panelOpen: true }],
    ['the tool is already open', { toolOpen: true }],
  ])('does nothing while %s', (_why, state) => {
    const { actions, handle } = setup(state)
    const event = key()
    handle(event)
    expect(actions.open).not.toHaveBeenCalled()
    expect(actions.notifyNoImage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing while a text field has focus', () => {
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    for (const target of [
      document.createElement('input'),
      document.createElement('textarea'),
      editable,
    ]) {
      const { actions, handle } = setup()
      handle(key({ target }))
      expect(actions.open).not.toHaveBeenCalled()
    }
  })

  it('opens from the C key on a non-Latin layout, but not from another letter there', () => {
    const { actions, handle } = setup()
    handle(key({ key: 'с', code: 'KeyC' })) // Cyrillic es on the C key
    handle(key({ key: 'j', code: 'KeyC' })) // Dvorak: the C key types j
    expect(actions.open).toHaveBeenCalledTimes(1)
  })

  it('ignores a held key’s repeats', () => {
    const { actions, handle } = setup({ hasWork: false })
    handle(key())
    handle(key({ repeat: true }))
    handle(key({ repeat: true }))
    expect(actions.notifyNoImage).toHaveBeenCalledTimes(1)
  })

  it('ignores c with Ctrl, Cmd or Alt, and other keys', () => {
    const { actions, handle } = setup()
    handle(key({ ctrlKey: true }))
    handle(key({ metaKey: true }))
    handle(key({ altKey: true }))
    handle(key({ key: 'x' }))
    expect(actions.open).not.toHaveBeenCalled()
  })
})

describe('Enter and Escape inside the tool (AC-20)', () => {
  function setup(blocked = false) {
    const actions = { blocked: () => blocked, apply: vi.fn(), cancel: vi.fn() }
    return { actions, handle: createToolKeys(actions) }
  }

  it('Escape cancels from anywhere, a field included', () => {
    const { actions, handle } = setup()
    handle(key({ key: 'Escape', target: document.createElement('input') }))
    expect(actions.cancel).toHaveBeenCalledTimes(1)
  })

  it('Enter applies, except on a button or in a field', () => {
    const { actions, handle } = setup()
    handle(key({ key: 'Enter', target: document.createElement('div') }))
    handle(key({ key: 'Enter', target: document.createElement('button') }))
    handle(key({ key: 'Enter', target: document.createElement('input') }))
    expect(actions.apply).toHaveBeenCalledTimes(1)
  })

  it('Enter on the Straighten slider, a checkbox or a radio applies the tool', () => {
    const { actions, handle } = setup()
    for (const type of ['range', 'checkbox', 'radio']) {
      const input = document.createElement('input')
      input.type = type
      handle(key({ key: 'Enter', target: input }))
    }
    expect(actions.apply).toHaveBeenCalledTimes(3)
  })

  it('does nothing while another modal surface owns the keys', () => {
    const { actions, handle } = setup(true)
    handle(key({ key: 'Escape' }))
    handle(key({ key: 'Enter' }))
    expect(actions.cancel).not.toHaveBeenCalled()
    expect(actions.apply).not.toHaveBeenCalled()
  })
})
