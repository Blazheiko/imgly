import { expect, test } from '@playwright/test'
import { canvasArea, dropGeneratedImage, gotoReady, view, waitForWork } from './helpers'

// QG-1b (sad.md §10): after one load, an open works with no network — the decode worker
// comes from the precache.
test('opens an image to a fitted Preview after going offline and reloading', async ({
  page,
  context,
  request,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload a page while offline')
  const sw = await (await request.get('sw.js')).text()
  expect(sw).toMatch(/assets\/decode\.worker-[\w-]+\.js/)

  await gotoReady(page)
  await page.evaluate(async () => {
    const container = navigator.serviceWorker
    await container.ready
    await new Promise<void>((resolve) => {
      if (container.controller) resolve()
      else container.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()

  await dropGeneratedImage(page, { width: 4000, height: 3000, type: 'image/jpeg' })
  await waitForWork(page, 4000, 3000)
  await expect(page.getByTestId('dimensions-readout')).toHaveText('4000 × 3000 px')
  const area = await canvasArea(page)
  expect((await view(page)).zoom).toBeCloseTo(Math.min(area.width / 4000, area.height / 3000, 1), 5)
})
