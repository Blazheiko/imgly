import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import AppLogo from './AppLogo.vue'
import indexHtml from '/index.html?raw'
import favicon from '/public/icons/favicon.svg?raw'
import viteConfig from '/vite.config.ts?raw'

// screens.md §Brand mark: the approved mark from brand/logo-concept.svg (symbol `mark`).
const CORNER_TOP_LEFT = 'M5 14V8a3 3 0 0 1 3-3h6'
const CORNER_BOTTOM_RIGHT = 'M27 18v6a3 3 0 0 1-3 3h-6'

describe('AppLogo (ui-refresh AC-01)', () => {
  it('draws the mark as decoration, followed by the wordmark "imgly"', () => {
    const wrapper = mount(AppLogo)
    const svg = wrapper.get('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    const paths = svg.findAll('path').map((path) => path.attributes('d'))
    expect(paths).toEqual([CORNER_TOP_LEFT, CORNER_BOTTOM_RIGHT])
    const dot = svg.get('circle')
    expect([dot.attributes('cx'), dot.attributes('cy'), dot.attributes('r')]).toEqual([
      '21',
      '11',
      '3',
    ])
    expect(wrapper.text()).toBe('imgly')
  })

  it('fills the mark with the brand gradient from tokens', () => {
    const svg = mount(AppLogo).get('svg')
    const gradient = svg.get('linearGradient')
    const id = gradient.attributes('id')
    expect(svg.get('path').attributes('stroke')).toBe(`url(#${id})`)
    expect(svg.get('circle').attributes('fill')).toBe(`url(#${id})`)
    const stops = gradient.findAll('stop').map((stop) => stop.attributes('style'))
    expect(stops).toEqual([
      'stop-color: var(--color-brand-from);',
      'stop-color: var(--color-brand-to);',
    ])
  })

  it('gives each instance its own gradient id', () => {
    const Host = defineComponent(() => () => h('div', [h(AppLogo), h(AppLogo)]))
    const ids = mount(Host)
      .findAll('linearGradient')
      .map((gradient) => gradient.attributes('id'))
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('adds no keyboard stop and no heading', () => {
    const wrapper = mount(AppLogo)
    expect(wrapper.findAll('a, button, [tabindex], h1, h2, h3').length).toBe(0)
  })

  it('draws the mark alone without the wordmark', () => {
    const wrapper = mount(AppLogo, { props: { wordmark: false } })
    expect(wrapper.text()).toBe('')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })
})

describe('brand icons outside the page (ui-refresh AC-01, SCR-04)', () => {
  it('has a tab icon drawn from the mark, with the PNG fallback kept', () => {
    expect(favicon).toContain(CORNER_TOP_LEFT)
    expect(favicon).toContain(CORNER_BOTTOM_RIGHT)
    expect(indexHtml).toMatch(
      /<link rel="icon" type="image\/svg\+xml" href="\/icons\/favicon\.svg"/,
    )
    expect(indexHtml).toMatch(/<link rel="icon" type="image\/png" href="\/icons\/icon-192\.png"/)
    expect(viteConfig).toContain("'icons/favicon.svg'")
  })
})
