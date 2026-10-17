import { expect, test } from '../harness'
import { gotoReady, openNumbered, reloadToStart } from '../gallery/helpers'
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

for (const width of [1280, 600]) {
  test(`AC-04: the drop area's edges line up with the Gallery's at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoReady(page)
    await openNumbered(page, 1)
    await reloadToStart(page, 1)
    const edges = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const box = el.getBoundingClientRect()
          return [box.left, box.right]
        })
    const [area, gallery] = [
      await edges('[data-testid="empty-canvas"]'),
      await edges('.gallery-list'),
    ]
    expect(Math.abs(area[0]! - gallery[0]!)).toBeLessThanOrEqual(1)
    expect(Math.abs(area[1]! - gallery[1]!)).toBeLessThanOrEqual(1)
  })
}

test('AC-01: every manifest and home-screen icon is the brand mark at its declared size', async ({
  page,
}) => {
  await gotoReady(page)
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = (await (await page.request.get(manifestHref!)).json()) as {
    icons: { src: string; sizes: string; purpose?: string }[]
  }
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  const icons = [
    ...manifest.icons.map((i) => ({
      src: new URL(i.src, page.url()).href,
      size: i.sizes,
      maskable: i.purpose === 'maskable',
    })),
    { src: new URL(appleHref!, page.url()).href, size: '180x180', maskable: false },
  ]
  expect(icons.length).toBeGreaterThanOrEqual(4)
  for (const icon of icons) {
    const drawn = await page.evaluate(async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data]
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let white = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 240 && data[i + 1]! > 240 && data[i + 2]! > 240 && data[i + 3]! > 240)
          white++
      }
      const w = canvas.width
      return { size: `${w}x${canvas.height}`, top: at(w / 2, w * 0.08), white: white / (w * w) }
    }, icon.src)
    expect(drawn.size, icon.src).toBe(icon.size)
    // The brand gradient behind the mark: Iris to violet, blue well above green.
    const [r, g, b, a] = drawn.top
    expect(a, icon.src).toBe(255)
    expect(b! - g!, `${icon.src} rgb(${r}, ${g}, ${b})`).toBeGreaterThan(120)
    // The white mark covers a visible share of the icon (about 5%, or 3% inside the smaller
    // maskable safe zone); the icons before this feature had none.
    expect(drawn.white, icon.src).toBeGreaterThan(icon.maskable ? 0.02 : 0.04)
  }
})
