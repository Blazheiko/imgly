import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('/src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

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
})
