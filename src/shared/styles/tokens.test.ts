import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'

const components = import.meta.glob<string>('/src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The custom-property declarations of the first `{ … }` block after `marker`. */
function declarations(marker: string): Map<string, string> {
  const start = tokensCss.indexOf(marker)
  if (start < 0) return new Map()
  let depth = 0
  let body = ''
  for (let i = tokensCss.indexOf('{', start); i < tokensCss.length; i++) {
    const ch = tokensCss[i]
    if (ch === '{') depth++
    if (ch === '}' && --depth === 0) break
    body += ch
  }
  const found = new Map<string, string>()
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(name!, value!.trim())
  }
  return found
}

const dark = declarations(':root')
const light = declarations('@media (prefers-color-scheme: light)')
const reducedMotion = declarations('@media (prefers-reduced-motion: reduce)')

// screens.md §Look decisions, Token values: each has a dark and a light value.
const V2_COLOURS = [
  '--color-brand',
  '--color-brand-gradient',
  '--color-accent',
  '--color-accent-gradient',
  '--color-accent-hover',
  '--color-accent-active',
  '--color-accent-text',
  '--color-accent-subtle',
  '--color-on-accent',
  '--color-focus-ring',
  '--color-titlebar',
  '--color-on-titlebar',
  '--color-on-titlebar-muted',
  '--color-titlebar-border',
  '--color-surface-sunken',
  '--color-border-strong',
  '--color-danger',
  '--color-danger-solid',
  '--color-danger-solid-hover',
  '--color-warning',
  '--color-glass',
  '--color-scrim',
]

/** WCAG relative luminance of #rrggbb. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** Every #rrggbb in a token value, e.g. both stops of a gradient. */
const hexes = (value: string | undefined) => value?.match(/#[0-9a-f]{6}\b/gi) ?? []

function ms(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value)
  if (!match) throw new Error(`not a duration: ${value}`)
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}

describe('design tokens', () => {
  it('sizes every box from tokens, never a hard-coded px width (CLAUDE.md Styling)', () => {
    const offenders = Object.entries(components).flatMap(([file, source]) => {
      const style = source.split('<style')[1] ?? ''
      return style
        .split('\n')
        .filter((line) => /^\s*(max-|min-)?width:/.test(line) && /\b(?!1px)\d+px/.test(line))
        .map((line) => `${file}: ${line.trim()}`)
    })
    expect(Object.keys(components).length).toBeGreaterThan(5)
    expect(offenders).toEqual([])
  })

  it('defines every v2 colour in the dark and the light theme (AC-13)', () => {
    expect(V2_COLOURS.filter((name) => !dark.has(name))).toEqual([])
    expect(V2_COLOURS.filter((name) => !light.has(name))).toEqual([])
  })

  it('takes the measured titlebar and brand values (screens.md §Token values)', () => {
    expect(dark.get('--color-titlebar')?.toUpperCase()).toBe('#15122A')
    expect(light.get('--color-titlebar')?.toUpperCase()).toBe('#F4F2FF')
    expect(dark.get('--color-brand')?.toUpperCase()).toBe('#6D5BFF')
    expect(dark.get('--color-accent-gradient')?.toUpperCase()).toBe(
      'LINEAR-GRADIENT(135DEG, #6D5BFF, #7B4FE8)',
    )
    expect(dark.get('--color-focus-ring')?.toUpperCase()).toBe('#A99CFF')
    expect(light.get('--color-focus-ring')?.toUpperCase()).toBe('#5847E6')
  })

  it('sizes controls, icons and the top bar (screens.md §Buttons)', () => {
    expect(dark.get('--control-height-sm')).toBe('28px')
    expect(dark.get('--control-height-md')).toBe('36px')
    expect(dark.get('--control-height-lg')).toBe('44px')
    expect(dark.get('--control-height')).toBe('var(--control-height-md)')
    expect(dark.get('--icon-size-sm')).toBe('16px')
    expect(dark.get('--icon-size-md')).toBe('20px')
    expect(dark.has('--icon-size-lg')).toBe(true)
    expect(dark.get('--toolbar-size')).toBe('56px')
  })

  // axe can't sample a gradient background and leaves that text "incomplete", so the primary
  // button's text is measured here against every stop it can show (AC-13, spec §6).
  it.each([
    ['dark', dark],
    ['light', light],
  ] as const)(
    'keeps primary-button text >= 4.5:1 on every gradient stop (%s, AC-13)',
    (_, theme) => {
      const text = theme.get('--color-on-accent')!
      const stops = [
        '--color-accent-gradient',
        '--color-accent-hover',
        '--color-accent-active',
      ].flatMap((name) => hexes(theme.get(name)))
      expect(stops.length).toBeGreaterThanOrEqual(5)
      for (const stop of stops)
        expect(contrast(text, stop), `${text} on ${stop}`).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('keeps every transition at or under 200 ms (spec §6)', () => {
    const durations = [...dark].filter(([name]) => name.startsWith('--duration-'))
    expect(durations.map(([name]) => name)).toEqual(
      expect.arrayContaining(['--duration-fast', '--duration-base']),
    )
    expect(dark.get('--duration-fast')).toBe('120ms')
    expect(dark.get('--duration-base')).toBe('200ms')
    for (const [, value] of durations) expect(ms(value)).toBeLessThanOrEqual(200)
  })

  it('drops every duration and the card lift to 0 under reduced motion (AC-14)', () => {
    const durations = [...dark.keys()].filter((name) => name.startsWith('--duration-'))
    expect(durations.length).toBeGreaterThan(0)
    for (const name of durations) expect(reducedMotion.get(name)).toBe('0ms')
    expect(dark.get('--lift-card')).toBe('-2px')
    expect(reducedMotion.get('--lift-card')).toBe('0px')
  })
})
