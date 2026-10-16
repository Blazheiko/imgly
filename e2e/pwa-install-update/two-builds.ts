import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve, sep } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test as harness } from '../harness'

/**
 * Two builds of the app, as GitHub Pages would serve them before and after a deploy: build A is the
 * e2e build (`dist-e2e`), build B the same app built with `VITE_E2E_BUILD=B` (`dist-e2e-b`), whose
 * hashed files all live under another directory, so after the switch A's files are gone from the
 * network exactly as on Pages (playwright.config.ts builds both).
 */
export type Build = 'A' | 'B'

const ROOT = resolve(import.meta.dirname, '../..')
const DIRS: Record<Build, string> = { A: join(ROOT, 'dist-e2e'), B: join(ROOT, 'dist-e2e-b') }
const BASE = '/imgly/'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
}

export interface TwoBuilds {
  /** The app's URL on this server, under `/imgly/`. */
  url: string
  /** Serves `build` from now on; the files of the other build are gone. */
  publish(build: Build): void
  /** While on, every request fails as a dropped connection, as offline or a broken network does. */
  failNetwork(on: boolean): void
  close(): Promise<void>
}

/** A static server for one test, on its own port (so its own origin and service worker). */
export async function startTwoBuilds(): Promise<TwoBuilds> {
  let current: Build = 'A'
  let failing = false

  async function serve(req: IncomingMessage, res: ServerResponse) {
    if (failing) {
      req.socket.destroy()
      return
    }
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end()
      return
    }
    const dir = DIRS[current]
    const relative = normalize(path.slice(BASE.length) || 'index.html')
    const file = join(dir, relative)
    if (!file.startsWith(dir + sep) && file !== dir) {
      res.writeHead(403).end()
      return
    }
    try {
      const body = await readFile(file)
      // No HTTP caching: what a check sees is exactly what is published now.
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    } catch {
      // Pages serves a 404 for a missing file; only a navigation gets the app's index.html.
      const navigation = (req.headers.accept ?? '').includes('text/html') && !extname(relative)
      if (!navigation) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' })
      res.end(await readFile(join(dir, 'index.html')))
    }
  }

  const server = createServer((req, res) => void serve(req, res))
  await new Promise<void>((done) => server.listen(0, 'localhost', done))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://localhost:${port}${BASE}`,
    publish(build) {
      current = build
    },
    failNetwork(on) {
      failing = on
    },
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}

/** `test` for the update specs: every test gets its own two-build server as its `baseURL`. */
export const test = harness.extend<{ builds: TwoBuilds }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern
  builds: async ({}, use) => {
    const builds = await startTwoBuilds()
    await use(builds)
    await builds.close()
  },
  baseURL: async ({ builds }, use) => use(builds.url),
})

export { expect }

/** Which build runs in the page: `A` or `B`. Waits for the lazily loaded test hooks first. */
export async function buildOf(page: Page) {
  await page.waitForFunction(() => window.__imglyTest != null, undefined, {
    timeout: 15_000,
    polling: 100,
  })
  return page.evaluate(() => window.__imglyTest!.buildMark())
}

/** Loads the app and waits until its service worker controls the page. */
export async function gotoControlled(page: Page, path = './') {
  await page.goto(path)
  await expect(
    page.getByTestId('empty-canvas').getByRole('button', { name: 'Open image' }),
  ).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 30_000,
  })
}

/** Looks for a new version now, as the 60-minute check does (`registration.update()`). */
export const checkForUpdate = (page: Page) =>
  page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update().catch(() => {})
  })

/**
 * Publishes build B and makes the page look for it; resolves once the update notice shows. The
 * new worker precaches the whole build first, which under a loaded parallel run can outlast one
 * wait, so it looks again every 10 s for up to a minute, as later scheduled checks would.
 */
export async function publishUpdate(builds: TwoBuilds, page: Page) {
  builds.publish('B')
  await expect(async () => {
    await checkForUpdate(page)
    await expect(updateNotice(page)).toBeVisible({ timeout: 10_000 })
  }).toPass({ timeout: 60_000 })
}

/** The one update notice (`.toast` with "Reload"). */
export const updateNotice = (page: Page) =>
  page.locator('.toast', { has: page.getByRole('button', { name: /^(Reload|Reloading…)$/ }) })

export const reloadButton = (page: Page) =>
  updateNotice(page).getByRole('button', { name: /^(Reload|Reloading…)$/ })

/**
 * Marks the page's document; `stillSamePage` is true only while no navigation or reload replaced
 * it. Every flow uses it to prove the app never reloaded on its own (spec §6: 0 unchosen reloads).
 */
export async function markPage(page: Page) {
  await page.evaluate(
    () => ((window as unknown as { __e2eSamePage: boolean }).__e2eSamePage = true),
  )
}

export const stillSamePage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __e2eSamePage?: boolean }).__e2eSamePage === true)
