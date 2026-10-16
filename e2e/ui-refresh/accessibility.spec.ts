import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '../harness'
import { gotoReady, openGallery, openNumbered, reloadToStart } from '../gallery/helpers'

// ui-refresh AC-13, spec §6: text ≥ 4.5:1 in both themes, checked by axe on the screens the spec
// names. axe's color-contrast rule already exempts disabled controls (native disabled or
// aria-disabled), as the accessibility guidelines do. axe has no rule for non-text contrast (icons,
// borders, the focus mark ≥ 3:1): screens.md §Token values measured those, and the focus mark is
// checked by hand.

async function contrastViolations(page: Page) {
  // Let colour transitions settle before sampling.
  await page.waitForTimeout(250)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .withRules(['color-contrast'])
    .analyze()
  return violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary ?? ''}`),
  )
}

const SCHEMES = ['dark', 'light'] as const

for (const colorScheme of SCHEMES) {
  test.describe(`${colorScheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    })

    test('the start screen with a Work card', async ({ page }) => {
      await gotoReady(page)
      await openNumbered(page, 1)
      await reloadToStart(page, 1)
      expect(await contrastViolations(page)).toEqual([])
    })

    test('the Gallery overlay with the open Work', async ({ page }) => {
      await gotoReady(page)
      await openNumbered(page, 1)
      await openNumbered(page, 2)
      await openGallery(page)
      expect(await contrastViolations(page)).toEqual([])
    })

    for (const tool of ['crop-rotate', 'adjust', 'draw'] as const) {
      test(`the ${tool} panel`, async ({ page }) => {
        await gotoReady(page)
        await openNumbered(page, 1, { saved: false })
        await page.getByTestId(`${tool}-action`).click()
        await expect(page.getByTestId(`${tool}-tool`)).toBeVisible()
        expect(await contrastViolations(page)).toEqual([])
      })
    }

    test('the export panel', async ({ page }) => {
      await gotoReady(page)
      await openNumbered(page, 1, { saved: false })
      await page
        .getByTestId('editor-top-bar')
        .getByRole('button', { name: /^Export/ })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(await contrastViolations(page)).toEqual([])
    })
  })
}
