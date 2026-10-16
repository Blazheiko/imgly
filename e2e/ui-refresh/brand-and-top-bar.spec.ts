import { expect, test } from '../harness'
import { gotoReady, openNumbered } from '../gallery/helpers'
import { computed, rgb, topBar } from './helpers'

// ui-refresh AC-01, AC-02, AC-03, AC-11, AC-15: what the browser draws needs a real browser.

test('AC-01: the tab icon is the brand mark, with the PNG fallback kept', async ({ page }) => {
  await gotoReady(page)
  const icons = await page
    .locator('link[rel="icon"]')
    .evaluateAll((links) => links.map((l) => [l.getAttribute('type'), l.getAttribute('href')]))
  expect(icons[0]).toEqual(['image/svg+xml', '/imgly/icons/favicon.svg'])
  expect(icons).toContainEqual(['image/png', '/imgly/icons/icon-192.png'])
  const favicon = await page.request.get('icons/favicon.svg')
  expect(favicon.ok()).toBe(true)
  await expect(topBar(page).locator('.app-logo')).toHaveText('imgly')
})

for (const [scheme, colour] of [
  ['dark', '#15122a'],
  ['light', '#f4f2ff'],
] as const) {
  test(`AC-11: in the ${scheme} theme the top bar takes the theme-color of the title bar`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await gotoReady(page)
    const tag = await page
      .locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`)
      .getAttribute('content')
    expect(tag?.toLowerCase()).toBe(colour)
    expect(await computed(page, '[data-testid="editor-top-bar"]', 'background-color')).toBe(
      rgb(colour),
    )
  })
}

test('AC-02, AC-15: four groups, Export last, no Install app and no stray divider without an offer', async ({
  page,
}) => {
  await gotoReady(page)
  await openNumbered(page, 1)
  const names = await topBar(page)
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()),
    )
  expect(names).toEqual([
    'Gallery',
    'Open image',
    'Undo',
    'Redo',
    'Crop and rotate',
    'Adjust',
    'Draw',
    'Export',
  ])
  await expect(topBar(page).locator('.editor-top-bar__divider')).toHaveCount(3)
})

test('AC-02, AC-03: every visible top-bar button shows one decorative icon', async ({ page }) => {
  await gotoReady(page)
  await openNumbered(page, 1)
  const buttons = topBar(page).getByRole('button')
  const count = await buttons.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i)
    await expect(button.locator('svg')).toHaveCount(1)
    await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    await expect(button.locator('svg')).toBeVisible()
  }
})
