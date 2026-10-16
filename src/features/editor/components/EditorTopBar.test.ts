import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { AppLogo } from '@/shared'
import EditorTopBar from './EditorTopBar.vue'
import source from './EditorTopBar.vue?raw'

const style = source.split('<style')[1] ?? ''

const button = (label: string) => `<button>${label}</button>`

function groups(wrapper: ReturnType<typeof mount>): string[][] {
  return wrapper
    .findAll('.editor-top-bar__group')
    .map((group) => group.findAll('button').map((b) => b.text()))
}

describe('EditorTopBar (ui-refresh SCR-01)', () => {
  it('starts with the brand mark and the visible name "imgly", not a heading (AC-01)', () => {
    const wrapper = mount(EditorTopBar, { props: { showOpen: false } })
    const logo = wrapper.findComponent(AppLogo)
    expect(logo.exists()).toBe(true)
    expect(logo.text()).toBe('imgly')
    expect(wrapper.find('h1, h2, h3').exists()).toBe(false)
    const first = wrapper.get('header').element.firstElementChild!
    expect(first.contains(logo.element)).toBe(true)
  })

  it('shows four groups in order, Install app before Export, Export last (AC-02)', () => {
    const wrapper = mount(EditorTopBar, {
      props: { showOpen: true },
      slots: {
        'leading-actions': button('Gallery'),
        history: button('Undo') + button('Redo'),
        tools: button('Crop and rotate') + button('Adjust') + button('Draw'),
        actions: button('Install app') + button('Export'),
      },
    })
    expect(groups(wrapper)).toEqual([
      ['Gallery', 'Open image'],
      ['Undo', 'Redo'],
      ['Crop and rotate', 'Adjust', 'Draw'],
      ['Install app', 'Export'],
    ])
    expect(wrapper.findAll('.editor-top-bar__divider')).toHaveLength(3)
  })

  it('leaves no group and no divider where a group is empty (no Work, AC-15)', () => {
    const wrapper = mount(EditorTopBar, {
      props: { showOpen: false },
      slots: {
        history: button('Undo') + button('Redo'),
        tools: button('Draw'),
        actions: button('Export'),
      },
    })
    expect(groups(wrapper)).toEqual([['Undo', 'Redo'], ['Draw'], ['Export']])
    expect(wrapper.findAll('.editor-top-bar__divider')).toHaveLength(2)
  })

  it('draws dividers only between groups, never first or last', () => {
    const wrapper = mount(EditorTopBar, {
      props: { showOpen: true },
      slots: { actions: button('Export') },
    })
    const row = wrapper.get('.editor-top-bar__actions').element
    expect(row.firstElementChild?.classList.contains('editor-top-bar__divider')).toBe(false)
    expect(row.lastElementChild?.classList.contains('editor-top-bar__divider')).toBe(false)
    for (const divider of wrapper.findAll('.editor-top-bar__divider')) {
      expect(divider.attributes('aria-hidden')).toBe('true')
    }
  })

  it('shows "Open image" as a ghost button with its icon (AC-02)', () => {
    const wrapper = mount(EditorTopBar, { props: { showOpen: true } })
    const open = wrapper.get('button')
    expect(open.text()).toBe('Open image')
    expect(open.classes()).toEqual(
      expect.arrayContaining(['base-button--ghost', 'base-button--md']),
    )
    expect(open.find('svg').exists()).toBe(true)
  })

  it('paints the bar in the titlebar colours (AC-11)', () => {
    const bar = /\.editor-top-bar\s*\{([^}]*)\}/.exec(style)?.[1] ?? ''
    expect(bar).toContain('background: var(--color-titlebar)')
    expect(bar).toContain('color: var(--color-on-titlebar)')
    expect(bar).toContain('var(--color-titlebar-border)')
  })
})
