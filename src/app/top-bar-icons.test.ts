import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, createWork, err, ok } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import { usePwaInstallUpdate } from '@/features/pwa-install-update'
import { fakeInstallPrompt } from '@/features/pwa-install-update/testing'
import { icons } from '@/shared'
import App from './App.vue'

const gallerydb = vi.hoisted(() => ({ openGalleryDb: vi.fn() }))
vi.mock('@/infra/db', async (orig) => ({
  ...(await orig<typeof import('@/infra/db')>()),
  openGalleryDb: gallerydb.openGalleryDb,
}))

// ui-refresh screens.md §Icon map, the top bar (SCR-01), with the names they had before.
const TOP_BAR: [name: string, icon: keyof typeof icons, labelShown: boolean][] = [
  ['Gallery', 'layout-grid', true],
  ['Open image', 'image-plus', true],
  ['Undo', 'undo-2', false],
  ['Redo', 'redo-2', false],
  ['Crop and rotate', 'crop', true],
  ['Adjust', 'sliders-horizontal', true],
  ['Draw', 'pen-line', true],
  ['Install app', 'monitor-down', true],
  ['Export', 'download', true],
]

/** The d of an icon's first path, to tell the icons apart in the DOM. */
function firstPath(icon: keyof typeof icons): string {
  const shape = icons[icon].find(([tag]) => tag === 'path') ?? icons[icon][0]!
  return (shape[1] as Record<string, string>).d ?? ''
}

describe('top-bar action icons (ui-refresh AC-02, AC-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    gallerydb.openGalleryDb.mockResolvedValue(
      err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })),
    )
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    usePwaInstallUpdate().connectInstall(fakeInstallPrompt({ offer: true }).client)
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  function topBarButtons(): HTMLButtonElement[] {
    return [
      ...document.querySelectorAll<HTMLButtonElement>('[data-testid="editor-top-bar"] button'),
    ]
  }

  const nameOf = (b: HTMLButtonElement) => (b.getAttribute('aria-label') ?? b.textContent)!.trim()

  it('keeps every action and its name, in the new order', () => {
    expect(topBarButtons().map(nameOf)).toEqual(TOP_BAR.map(([name]) => name))
  })

  it.each(TOP_BAR)('%s shows one decorative %s icon', (name, icon, labelShown) => {
    const button = topBarButtons().find((b) => nameOf(b) === name)!
    const svgs = button.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    expect(svgs[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(svgs[0]!.querySelector('path, rect')?.getAttribute('d') ?? '').toBe(
      icon === 'layout-grid' ? '' : firstPath(icon),
    )
    expect(button.textContent!.trim()).toBe(labelShown ? name : '')
    if (!labelShown) expect(button.getAttribute('title')).toBeTruthy()
  })

  it('draws every top-bar button at the md size, Export primary and the rest ghost', () => {
    for (const button of topBarButtons()) {
      expect(button.classList.contains('base-button--md')).toBe(true)
      const variant = nameOf(button) === 'Export' ? 'primary' : 'ghost'
      expect(button.classList.contains(`base-button--${variant}`), nameOf(button)).toBe(true)
    }
  })

  it('leaves the unavailable look to BaseButton, never a fade (AC-13)', async () => {
    editor.work = null
    await nextTick()
    for (const button of topBarButtons()) {
      if (button.getAttribute('aria-disabled') !== 'true') continue
      const own = [...button.classList].filter((c) => c.endsWith('--unavailable'))
      expect(own, nameOf(button)).toEqual([])
    }
  })
})
