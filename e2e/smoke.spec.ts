import { expect, test } from '@playwright/test'

test('the app loads at /imgly/ and shows the editor', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByTestId('editor-view')).toBeVisible()
})

test('the manifest is served with the /imgly/ scope', async ({ request }) => {
  const response = await request.get('manifest.webmanifest')
  expect(response.ok()).toBe(true)

  const manifest = await response.json()
  expect(manifest).toMatchObject({ scope: '/imgly/', start_url: '/imgly/', display: 'standalone' })
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
})

test('after the first load, the editor still renders offline', async ({ page, context }) => {
  await page.goto('./')
  // Wait until the precaching service worker controls the page.
  await page.evaluate(async () => {
    const sw = navigator.serviceWorker
    await sw.ready
    await new Promise<void>((resolve) => {
      sw.addEventListener('controllerchange', () => resolve(), { once: true })
      if (sw.controller) resolve()
    })
  })

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByTestId('editor-view')).toBeVisible()
})
