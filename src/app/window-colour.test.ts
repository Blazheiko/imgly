import { describe, expect, it } from 'vitest'
import tokensCss from '@/shared/styles/tokens.css?raw'
import indexHtml from '/index.html?raw'
import viteConfig from '/vite.config.ts?raw'

// ui-refresh ADR-0002: the window colour is written in three files; this keeps them equal.

function titlebar(block: string): string | undefined {
  return /--color-titlebar:\s*(#[0-9a-f]{6})\s*;/i.exec(block)?.[1]?.toLowerCase()
}

const lightStart = tokensCss.indexOf('@media (prefers-color-scheme: light)')
const darkTitlebar = titlebar(tokensCss.slice(0, lightStart))
const lightTitlebar = titlebar(tokensCss.slice(lightStart))

function themeColor(scheme: 'dark' | 'light'): string | undefined {
  const tag = new RegExp(
    `<meta name="theme-color" media="\\(prefers-color-scheme: ${scheme}\\)" content="(#[0-9a-f]{6})"`,
    'i',
  ).exec(indexHtml)
  return tag?.[1]?.toLowerCase()
}

function manifest(key: 'theme_color' | 'background_color'): string | undefined {
  return new RegExp(`${key}: '(#[0-9a-f]{6})'`, 'i').exec(viteConfig)?.[1]?.toLowerCase()
}

describe('window colour (ui-refresh AC-11)', () => {
  it('reads the titlebar token in both themes', () => {
    expect(darkTitlebar).toBe('#15122a')
    expect(lightTitlebar).toBe('#f4f2ff')
  })

  it('declares one theme-color per system theme, matching the token (index.html)', () => {
    expect(themeColor('dark')).toBe(darkTitlebar)
    expect(themeColor('light')).toBe(lightTitlebar)
    expect(indexHtml.match(/<meta name="theme-color"/g)).toHaveLength(2)
  })

  it('starts the Installed app in the dark titlebar colour (vite.config.ts manifest)', () => {
    expect(manifest('theme_color')).toBe(darkTitlebar)
    expect(manifest('background_color')).toBe(darkTitlebar)
  })
})
