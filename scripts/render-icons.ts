// Renders the PNG app icons in public/icons/ from the approved brand mark (ui-refresh screens.md
// §Brand mark, SCR-04) with Playwright's Chromium. Dev only: run `pnpm icons` after the artwork
// changes and commit the PNGs (sad.md §11, accepted debt).
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url))

// The gradient stops are the only colours here: the PNGs are assets, not component styles.
const FROM = '#6D5BFF'
const TO = '#A35BFF'
const MARK = `
  <path d="M5 14V8a3 3 0 0 1 3-3h6" fill="none" stroke="#FFFFFF" stroke-width="3.25" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M27 18v6a3 3 0 0 1-3 3h-6" fill="none" stroke="#FFFFFF" stroke-width="3.25" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="21" cy="11" r="3" fill="#FFFFFF" />`

interface IconSpec {
  file: string
  size: number
  /** Corner radius as a share of the side; 0 is full bleed. */
  radius: number
  /** The mark's side as a share of the icon's side. */
  mark: number
}

const ICONS: IconSpec[] = [
  { file: 'icon-192.png', size: 192, radius: 0.22, mark: 0.6 },
  { file: 'icon-512.png', size: 512, radius: 0.22, mark: 0.6 },
  // Inside the central 80 % safe circle (maskable icon spec).
  { file: 'icon-maskable-512.png', size: 512, radius: 0, mark: 0.46 },
  // iOS rounds the corners itself.
  { file: 'apple-touch-icon-180.png', size: 180, radius: 0, mark: 0.6 },
]

function svg({ size, radius, mark }: IconSpec): string {
  const side = size * mark
  const offset = (size - side) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FROM}" /><stop offset="1" stop-color="${TO}" /></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#g)" />
  <svg x="${offset}" y="${offset}" width="${side}" height="${side}" viewBox="0 0 32 32">${MARK}</svg>
</svg>`
}

const browser = await chromium.launch()
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } })
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg(icon)}</body></html>`,
    )
    await page
      .locator('svg')
      .first()
      .screenshot({ path: `${OUT}${icon.file}`, omitBackground: true })
    await page.close()
    console.log(`rendered ${icon.file}`)
  }
} finally {
  await browser.close()
}
