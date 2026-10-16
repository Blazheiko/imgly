import { expect, test, type Page } from '../harness'
import { gotoReady, openNumbered, reloadToStart } from '../gallery/helpers'
import { computed } from './helpers'

// ui-refresh AC-06, AC-14: hover lift and its absence under reduced motion need real layout.

/** The card's top relative to its grid, so a scroll from hover() doesn't count as a lift. */
async function cardOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const card = document.querySelector('.gallery-entry')!.getBoundingClientRect()
    const grid = document.querySelector('.gallery-list__grid')!.getBoundingClientRect()
    return card.top - grid.top
  })
}

async function startWithOneCard(page: Page) {
  await gotoReady(page)
  await openNumbered(page, 1)
  await reloadToStart(page, 1)
}

test('AC-06: pointing at a card lifts it by at most 4 px and reveals its Delete', async ({
  page,
}) => {
  await startWithOneCard(page)
  const card = page.locator('.gallery-entry').first()
  const before = await cardOffset(page)
  await card.hover()
  await expect.poll(async () => before - (await cardOffset(page))).toBeGreaterThan(0)
  expect(before - (await cardOffset(page))).toBeLessThanOrEqual(4)
  await expect(card.locator('[data-delete-id]')).toHaveCSS('opacity', '1')
})

test('AC-14: with reduced motion nothing lifts and no transition takes time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startWithOneCard(page)
  const card = page.locator('.gallery-entry').first()
  const before = await cardOffset(page)
  await card.hover()
  await expect(card.locator('[data-delete-id]')).toHaveCSS('opacity', '1')
  expect(await cardOffset(page)).toBe(before)
  for (const selector of ['.gallery-entry', '.gallery-entry [data-delete-id]']) {
    const durations = (await computed(page, selector, 'transition-duration')).split(',')
    expect(
      durations.every((d) => Number.parseFloat(d) === 0),
      selector,
    ).toBe(true)
  }
  // Every action still works: the card reopens its Work.
  await card.locator('.gallery-entry__button').click()
  await expect(page.getByTestId('gallery-start')).toBeHidden()
})

test('AC-07: keyboard focus on a card shows its Delete without pointing', async ({ page }) => {
  await startWithOneCard(page)
  const card = page.locator('.gallery-entry').first()
  await card.locator('.gallery-entry__button').focus()
  await expect(card.locator('[data-delete-id]')).toHaveCSS('opacity', '1')
  // WebKit moves focus between buttons with Option+Tab only.
  await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
  await expect(card.locator('[data-delete-id]')).toBeFocused()
  await expect(card.locator('[data-delete-id]')).toHaveCSS('opacity', '1')
})
