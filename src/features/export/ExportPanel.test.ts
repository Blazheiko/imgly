import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, createWork, err, ok, type AppError, type ImageFormat, type Result } from '@/core'
import { useEditorStore } from '@/features/editor'
import type { ExportRequest, FormatAvailabilityCheck } from '@/render'
import ExportPanel from './ExportPanel.vue'
import { useExportStore } from './store'

const ALL: FormatAvailabilityCheck = { png: true, jpeg: true, webp: true }
const blob = new Blob([new Uint8Array([1])])

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('ExportPanel (SCR-03)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>
  let anchor: HTMLButtonElement
  let wrapper: VueWrapper
  let exporter: ReturnType<typeof vi.fn<(r: ExportRequest) => Promise<Result<Blob, AppError>>>>
  let resolveCheck: (value: FormatAvailabilityCheck) => void

  function openWork(sourceFormat: ImageFormat = 'jpeg', hasTransparency = false) {
    const pixels = { width: 4096, height: 3072, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 4096, height: 3072, pixels, hasTransparency }, 'w-1', {
      sourceName: 'IMG_4021',
      sourceFormat,
    })
  }

  async function setup(
    opts: {
      check?: 'pending' | FormatAvailabilityCheck
      format?: ImageFormat
      transparent?: boolean
    } = {},
  ) {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(
      () => new Promise<FormatAvailabilityCheck>((resolve) => (resolveCheck = resolve)),
    )
    store.setSaveDialogProbe(() => true)
    exporter = vi.fn(async () => ok(blob))
    store.setExporter(exporter)
    store.setBitmapCopier(async (b) => b)
    store.setSavePlatform({
      pickSaveTarget: vi.fn(async () =>
        ok({
          kind: 'picked' as const,
          handle: { name: 'x' } as never,
          name: 'IMG_4021-edited.jpg',
        }),
      ),
      writeFile: vi.fn(async () => ok(undefined)),
      discardEmptyTarget: vi.fn(async () => true),
      downloadFile: vi.fn(),
    })
    openWork(opts.format ?? 'jpeg', opts.transparent ?? false)
    await flush()
    if (opts.check !== 'pending') resolveCheck(opts.check ?? ALL)
    await flush()

    anchor = document.createElement('button')
    document.body.appendChild(anchor)
    wrapper = mount(ExportPanel, { props: { anchor }, attachTo: document.body })
    store.openPanel()
    await flush()
  }

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  const radios = (group: string) =>
    wrapper.findAll(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`)
  const checked = (group: string) =>
    radios(group)
      .filter((r) => r.attributes('aria-checked') === 'true')
      .map((r) => r.text())
  const textInput = (label: string) => {
    const id = wrapper
      .findAll('label')
      .find((l) => l.text() === label)!
      .attributes('for')
    return wrapper.get<HTMLInputElement>(`#${CSS.escape(id!)}`)
  }
  const confirmButton = () => wrapper.findAll('button').find((b) => /Export/.test(b.text()))!
  const escape = () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

  describe('default', () => {
    beforeEach(() => setup())

    it('renders every part of the panel for the Work', () => {
      expect(wrapper.find('[role="dialog"][aria-label="Export"]').exists()).toBe(true)
      expect(checked('Format')).toEqual(['JPEG'])
      expect(wrapper.find('input[type="range"][aria-label="Quality"]').exists()).toBe(true)
      expect(checked('Size')).toEqual(['100%'])
      expect(textInput('Long side').element.value).toBe('4096')
      expect(wrapper.text()).toContain('4096 × 3072 px')
      expect(wrapper.text()).toContain('IMG_4021-edited.jpg')
      expect(wrapper.text()).toContain("You'll choose where to save it.")
      expect(confirmButton().attributes('disabled')).toBeUndefined()
    })

    it('moves focus to the selected format option on open', () => {
      expect(document.activeElement?.textContent?.trim()).toBe('JPEG')
    })

    it('hides the quality setting for PNG (AC-04)', async () => {
      await radios('Format')[0]!.trigger('click')
      expect(checked('Format')).toEqual(['PNG'])
      expect(wrapper.find('input[type="range"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('IMG_4021-edited.png')
    })

    it('validation: a typed long side is applied on blur and the readout updates (AC-05, AC-06)', async () => {
      const input = textInput('Long side')
      await input.setValue('5000')
      await input.trigger('blur')
      expect(input.element.value).toBe('4096')
      await input.setValue('2048')
      await input.trigger('blur')
      expect(wrapper.text()).toContain('2048 × 1536 px')
      expect(checked('Size')).toEqual(['50%'])
      await input.setValue('2000')
      await input.trigger('blur')
      expect(checked('Size')).toEqual([])
      expect(wrapper.text()).toContain('2000 × 1500 px')
    })

    it('Enter in a field applies the value and never exports (AC-17)', async () => {
      const input = textInput('Quality')
      await input.setValue('150')
      await input.trigger('keydown', { key: 'Enter' })
      await flush()
      expect(store.quality).toBe(100)
      expect(exporter).not.toHaveBeenCalled()
    })

    it('confirm applies a value still being typed first, then exports with it (AC-17)', async () => {
      await textInput('Quality').setValue('33')
      await confirmButton().trigger('click')
      await flush()
      expect(exporter).toHaveBeenCalledTimes(1)
      expect(exporter.mock.calls[0]![0].quality).toBe(33)
    })

    it('Escape applies a value still being typed, remembers it and closes (AC-19)', async () => {
      await textInput('Quality').setValue('12')
      escape()
      await flush()
      expect(store.quality).toBe(12)
      expect(store.panelOpen).toBe(false)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('closes and names the file after a successful save', async () => {
      await confirmButton().trigger('click')
      await flush()
      expect(store.panelOpen).toBe(false)
    })
  })

  it('format checking: JPEG and WebP disabled with the checking hint, PNG selected (AC-12)', async () => {
    await setup({ check: 'pending' })
    expect(checked('Format')).toEqual(['PNG'])
    const [, jpeg, webp] = radios('Format')
    expect(jpeg!.attributes('disabled')).toBeDefined()
    expect(webp!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Checking this browser…')

    resolveCheck(ALL)
    await flush()
    expect(checked('Format')).toEqual(['PNG'])
  })

  it('format unavailable: disabled with its hint (AC-12)', async () => {
    await setup({ check: { png: true, jpeg: true, webp: false } })
    expect(radios('Format')[2]!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain("WebP isn't available in this browser.")
  })

  it('JPEG transparency hint for a transparent Work only (AC-15)', async () => {
    await setup({ transparent: true })
    expect(wrapper.text()).toContain('JPEG has no transparency')
    await radios('Format')[2]!.trigger('click')
    expect(wrapper.text()).not.toContain('JPEG has no transparency')
  })

  it('loading: controls disabled, "Exporting…" with a spinner, Escape and outside do nothing', async () => {
    await setup()
    let release!: () => void
    exporter.mockImplementationOnce(() => new Promise((r) => (release = () => r(ok(blob)))))
    await confirmButton().trigger('click')
    await flush()

    expect(radios('Format').every((r) => r.attributes('disabled') !== undefined)).toBe(true)
    expect(textInput('Long side').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="range"]').attributes('disabled')).toBeDefined()
    const button = confirmButton()
    expect(button.text()).toContain('Exporting…')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.find('[role="status"]').exists()).toBe(true)

    escape()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(store.panelOpen).toBe(true)

    release()
    await flush()
  })

  it('disables the confirm while the editor reads an image', async () => {
    await setup()
    editor.phase = 'reading'
    await flush()
    expect(confirmButton().attributes('disabled')).toBeDefined()
    editor.phase = 'idle'
    await flush()
    expect(confirmButton().attributes('disabled')).toBeUndefined()
  })

  it('file ready: "Your file is ready." and a focused Save… that opens the dialog again', async () => {
    await setup()
    const pick = vi
      .fn()
      .mockResolvedValueOnce(ok({ kind: 'activationLapsed' }))
      .mockResolvedValueOnce(ok({ kind: 'cancelled' }))
    store.setSavePlatform({ pickSaveTarget: pick })
    await confirmButton().trigger('click')
    await flush()

    expect(store.status).toBe('fileReady')
    expect(wrapper.text()).toContain('Your file is ready.')
    const save = wrapper.findAll('button').find((b) => b.text() === 'Save…')!
    expect(document.activeElement).toBe(save.element)
    expect(radios('Format').every((r) => r.attributes('disabled') !== undefined)).toBe(true)

    await save.trigger('click')
    await flush()
    expect(pick).toHaveBeenCalledTimes(2)
    expect(store.status).toBe('idle')
  })

  it('file ready: Escape ends the export as cancelled and keeps the panel on its choices', async () => {
    await setup()
    store.setSavePlatform({
      pickSaveTarget: vi.fn(async () => ok({ kind: 'activationLapsed' as const })),
    })
    await confirmButton().trigger('click')
    await flush()
    escape()
    await flush()
    expect(store.status).toBe('idle')
    expect(editor.phase).toBe('idle')
    expect(store.panelOpen).toBe(true)
    expect(checked('Format')).toEqual(['JPEG'])
  })

  it('error: controls enabled again with the same choices; a WebP mismatch moves to PNG (AC-12, AC-17)', async () => {
    await setup({ format: 'webp' })
    exporter.mockResolvedValueOnce(
      err(appError('EXPORT_FORMAT_MISMATCH', { asked: 'webp', produced: 'png' })),
    )
    await confirmButton().trigger('click')
    await flush()

    expect(store.panelOpen).toBe(true)
    expect(checked('Format')).toEqual(['PNG'])
    expect(radios('Format')[2]!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain("WebP isn't available in this browser.")
    expect(confirmButton().attributes('disabled')).toBeUndefined()
  })
})
