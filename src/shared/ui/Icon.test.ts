import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { icons, type IconName } from '../icons'
import Icon from './Icon.vue'

// screens.md §Icon map: every icon the restyled app uses.
const ICON_MAP: IconName[] = [
  'layout-grid',
  'image-plus',
  'undo-2',
  'redo-2',
  'crop',
  'sliders-horizontal',
  'pen-line',
  'monitor-down',
  'download',
  'save',
  'x',
  'trash-2',
  'check',
  'rotate-ccw',
  'rotate-ccw-square',
  'rotate-cw-square',
  'flip-horizontal-2',
  'flip-vertical-2',
  'wand-sparkles',
  'eye',
  'eraser',
  'replace',
  'refresh-cw',
  'zoom-out',
  'zoom-in',
  'scan',
  'maximize',
  'image-off',
  'info',
]

describe('icon registry', () => {
  it('holds every icon of the map and nothing unused', () => {
    expect(ICON_MAP).toHaveLength(29)
    expect(Object.keys(icons).sort()).toEqual([...ICON_MAP].sort())
  })
})

describe('Icon', () => {
  it.each(ICON_MAP)('renders %s as a decorative svg with its shapes', (name) => {
    const svg = mount(Icon, { props: { name } }).find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
    expect(svg.attributes('stroke')).toBe('currentColor')
    expect(svg.attributes('stroke-width')).toBe('1.75')
    expect(svg.element.children.length).toBeGreaterThan(0)
  })

  it('defaults to the small size and takes md and lg (screens.md §Buttons)', () => {
    expect(mount(Icon, { props: { name: 'x' } }).classes()).toContain('icon--sm')
    expect(mount(Icon, { props: { name: 'x', size: 'md' } }).classes()).toContain('icon--md')
    expect(mount(Icon, { props: { name: 'x', size: 'lg' } }).classes()).toContain('icon--lg')
  })

  it('leaves the accessible name of its button to the label (AC-03)', () => {
    const Host = defineComponent(() => () => h('button', [h(Icon, { name: 'download' }), 'Export']))
    const button = mount(Host).find('button')
    expect(button.text()).toBe('Export')
    expect(button.find('svg title').exists()).toBe(false)
  })
})
