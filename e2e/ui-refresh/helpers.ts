import type { Page } from '../harness'

export const topBar = (page: Page) => page.getByTestId('editor-top-bar')

/** The computed value of `property` on the first element matching `selector`. */
export const computed = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)

/** #rrggbb to the rgb() form getComputedStyle reports. */
export function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
