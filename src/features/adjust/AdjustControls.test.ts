import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { autoAdjust, createWork, NEUTRAL_ADJUSTMENTS, ok, type Adjustments } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import AdjustControls, { AUTO_SHOWN_MARK } from './AdjustControls.vue'
import { BUTTONS, GROUPS, hintNothingToCorrect, SLIDER_LABELS, SLIDER_TOOLTIP } from './messages'
import { useAdjustStore } from './store'

describe('AdjustControls (SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useAdjustStore>
  let fake: ReturnType<typeof createFakeRenderer>

  function openWork(adjustments: Partial<Adjustments> = {}) {
    const pixels = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
    const work = createWork<ImageBitmap, OffscreenCanvas>(
      { width: 800, height: 600, pixels, hasTransparency: false },
      'w-1',
      {
        sourceName: 'a',
        sourceFormat: 'png',
      },
    )
    editor.work = { ...work, adjustments: { ...NEUTRAL_ADJUSTMENTS, ...adjustments } }
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    fake = createFakeRenderer()
    editor.setRendererFactory(fake.factory)
    editor.createRenderer({} as HTMLCanvasElement)
    await editor.runCapabilityGate(async () => ok(undefined))
    tool = useAdjustStore()
    openWork({ temperature: 35 })
    tool.open()
    wrapper = mount(AdjustControls, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  const ranges = () => wrapper.findAll('input[type="range"]')
  const range = (label: string) => wrapper.get(`input[type="range"][aria-label="${label}"]`)
  const field = (label: string) =>
    wrapper
      .findAll('input[type="text"]')
      .find(
        (input) =>
          document.querySelector(`label[for="${input.attributes('id')}"]`)?.textContent?.trim() ===
          label,
      )!
  const buttonNamed = (name: string) => wrapper.findAll('button').find((b) => b.text() === name)!

  it('leaves the Draft as it was after a slider is dragged far out and back (AC-07)', async () => {
    const before = { ...tool.draft! }
    for (const v of ['60', '100']) await range('Temperature').setValue(v)
    expect(tool.draft!.temperature).toBe(100)
    for (const v of ['-100', '0', '35']) await range('Temperature').setValue(v)
    expect(tool.draft).toEqual(before)
    expect(editor.previewAdjustments).toEqual(before)
  })

  it('lists the seven sliders in AC-01 order in three groups, with ranges, marks and units', () => {
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual([
      GROUPS.light,
      GROUPS.colour,
      GROUPS.effects,
    ])
    expect(ranges().map((r) => r.attributes('aria-label'))).toEqual([
      'Brightness',
      'Contrast',
      'Saturation',
      'Temperature',
      'Tint',
      'Grayscale',
      'Sepia',
    ])
    for (const r of ranges().slice(0, 5)) {
      expect([r.attributes('min'), r.attributes('max'), r.attributes('step')]).toEqual([
        '-100',
        '100',
        '1',
      ])
    }
    for (const r of ranges().slice(5)) {
      expect([r.attributes('min'), r.attributes('max')]).toEqual(['0', '100'])
    }
    for (const r of ranges()) {
      const list = document.getElementById(r.attributes('list')!)!
      expect([...list.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
        '0',
      ])
      expect(r.attributes('title')).toBe(SLIDER_TOOLTIP)
    }
    const units = wrapper.findAll('.number-field__unit').map((u) => u.text())
    expect(units).toEqual(['%', '%'])
    expect(SLIDER_LABELS.temperature).toBe('Temperature')
  })

  it('shows the Draft in each slider and field', () => {
    expect((range('Temperature').element as HTMLInputElement).value).toBe('35')
    expect((field('Temperature').element as HTMLInputElement).value).toBe('35')
  })

  it('moves the Draft as a slider is dragged', async () => {
    await range('Brightness').setValue('42')
    expect(tool.draft!.brightness).toBe(42)
    expect(editor.previewAdjustments!.brightness).toBe(42)
  })

  it('commits typed values by the AC-05 rule on leaving the field or Enter, never applying', async () => {
    const contrast = field('Contrast')
    await contrast.setValue('150')
    expect(tool.draft!.contrast).toBe(0) // nothing checked while typing
    await contrast.trigger('blur')
    expect(tool.draft!.contrast).toBe(100)
    expect((contrast.element as HTMLInputElement).value).toBe('100')

    const sepia = field('Sepia')
    await sepia.setValue('60%')
    await sepia.trigger('keydown', { key: 'Enter' })
    expect(tool.draft!.sepia).toBe(60)
    expect((sepia.element as HTMLInputElement).value).toBe('60')
    expect(editor.activeTool).toBe('adjust')
  })

  it('shows 0 in the field and the slider after "0" and Enter (AC-10)', async () => {
    const temperature = field('Temperature')
    expect((temperature.element as HTMLInputElement).value).toBe('35')
    await temperature.setValue('0')
    await temperature.trigger('keydown', { key: 'Enter' })
    expect((temperature.element as HTMLInputElement).value).toBe('0')
    expect((range('Temperature').element as HTMLInputElement).value).toBe('0')
  })

  it('sets a slider to neutral on a double-click (AC-10)', async () => {
    await range('Temperature').trigger('dblclick')
    expect(tool.draft!.temperature).toBe(0)
  })

  describe('Compare (AC-08)', () => {
    const compare = () => buttonNamed(BUTTONS.compare)

    it('holds while the pointer is down, shown as pressed, and ends on up, cancel or leave', async () => {
      expect(compare().attributes('aria-pressed')).toBe('false')
      for (const end of ['pointerup', 'pointercancel', 'pointerleave']) {
        await compare().trigger('pointerdown', { button: 0 })
        expect(tool.comparing).toBe(true)
        expect(compare().attributes('aria-pressed')).toBe('true')
        await compare().trigger(end)
        expect(tool.comparing).toBe(false)
      }
    })

    it('ignores other mouse buttons', async () => {
      await compare().trigger('pointerdown', { button: 2 })
      expect(tool.comparing).toBe(false)
    })

    it.each([' ', 'Enter'])('holds while %j is held on the focused button', async (key) => {
      const down = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true })
      compare().element.dispatchEvent(down)
      expect(tool.comparing).toBe(true)
      expect(down.defaultPrevented).toBe(true)
      compare().element.dispatchEvent(
        new KeyboardEvent('keydown', { key, repeat: true, bubbles: true }),
      )
      compare().element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
      expect(tool.comparing).toBe(false)
    })

    it('keeps its keys from reaching the tool’s Enter-applies handler', () => {
      let reached = false
      const onKey = () => (reached = true)
      window.addEventListener('keydown', onKey)
      compare().element.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
      )
      window.removeEventListener('keydown', onKey)
      expect(reached).toBe(false)
    })
  })

  describe('Auto (AC-12, AC-13)', () => {
    const auto = () => buttonNamed(BUTTONS.auto)
    const status = () => wrapper.get('[role="status"]')

    it('is disabled while the display is lost or being restored, the rest still works', async () => {
      editor.setRendererStatus('restoring')
      await nextTick()
      expect(auto().attributes('disabled')).toBeDefined()
      expect(buttonNamed(BUTTONS.apply).attributes('disabled')).toBeUndefined()
      expect(range('Brightness').attributes('disabled')).toBeUndefined()
      editor.setRendererStatus('ready')
      await nextTick()
      expect(auto().attributes('disabled')).toBeUndefined()
    })

    it('marks the frame after its values are shown, for the @perf suite (sad.md §7)', async () => {
      const mark = vi.spyOn(performance, 'mark')
      const frames: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => frames.push(fn))
      await auto().trigger('click')
      expect(mark).not.toHaveBeenCalledWith(AUTO_SHOWN_MARK)
      frames.shift()!(0)
      frames.shift()!(0)
      expect(mark).toHaveBeenCalledWith(AUTO_SHOWN_MARK)
      vi.restoreAllMocks()
    })

    it('shows the four values it found in their sliders and fields (AC-12)', async () => {
      // A dim, warm ramp: every one of the four values moves.
      const data = new Uint8Array(
        Array.from({ length: 64 }, (_, i) => [40 + i, 30 + i, 10 + i, 255]).flat(),
      )
      const sample = { width: 64, height: 1, data }
      const found = autoAdjust(sample)
      if (found.kind !== 'values') throw new Error('the sample should give values')
      fake.renderer.sampleCrop.mockReturnValue(ok(sample))
      await auto().trigger('click')
      for (const [key, label] of [
        ['brightness', 'Brightness'],
        ['contrast', 'Contrast'],
        ['temperature', 'Temperature'],
        ['tint', 'Tint'],
      ] as const) {
        const shown = String(found.values[key])
        expect(found.values[key], key).not.toBe(0)
        expect((field(label).element as HTMLInputElement).value, label).toBe(shown)
        expect((range(label).element as HTMLInputElement).value, label).toBe(shown)
      }
      expect(status().text()).toBe('')
    })

    it('shows the nothing-to-correct hint, and clears it on the next change', async () => {
      expect(status().text()).toBe('')
      fake.renderer.sampleCrop.mockReturnValue(
        ok({ width: 1, height: 1, data: new Uint8Array([9, 9, 9, 255]) }),
      )
      await auto().trigger('click')
      expect(status().text()).toBe(hintNothingToCorrect())
      await range('Tint').setValue('5')
      expect(status().text()).toBe('')
    })
  })

  describe('footer (AC-09, AC-10)', () => {
    it('Reset sets the Draft neutral, Cancel and Apply close the tool', async () => {
      await buttonNamed(BUTTONS.reset).trigger('click')
      expect(tool.draft).toEqual(NEUTRAL_ADJUSTMENTS)
      await buttonNamed(BUTTONS.cancel).trigger('click')
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.adjustments.temperature).toBe(35)

      tool.open()
      await nextTick()
      await range('Sepia').setValue('20')
      await buttonNamed(BUTTONS.apply).trigger('click')
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.adjustments.sepia).toBe(20)
    })

    it('shows every slider and field at 0 after Reset (AC-10)', async () => {
      await range('Brightness').setValue('42')
      await range('Sepia').setValue('30')
      await buttonNamed(BUTTONS.reset).trigger('click')
      for (const label of Object.values(SLIDER_LABELS)) {
        expect((field(label).element as HTMLInputElement).value, label).toBe('0')
        expect((range(label).element as HTMLInputElement).value, label).toBe('0')
      }
    })

    it('Apply with an unchanged Draft makes no edit; after a change it raises Unsaved edits (AC-11)', async () => {
      const revision = editor.work!.revision
      expect(editor.hasUnsavedEdits).toBe(false)
      await buttonNamed(BUTTONS.apply).trigger('click')
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.revision).toBe(revision)
      expect(editor.hasUnsavedEdits).toBe(false)

      tool.open()
      await nextTick()
      await range('Contrast').setValue('12')
      await buttonNamed(BUTTONS.apply).trigger('click')
      expect(editor.work!.revision).toBe(revision + 1)
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('reaches the controls in panel order with Tab (AC-21)', () => {
      const focusable = [...wrapper.element.querySelectorAll('input, button')].map((el) =>
        el instanceof HTMLButtonElement ? el.textContent!.trim() : el.getAttribute('type'),
      )
      expect(focusable).toEqual([
        ...Array.from({ length: 7 }, () => ['range', 'text']).flat(),
        BUTTONS.compare,
        BUTTONS.auto,
        BUTTONS.reset,
        BUTTONS.cancel,
        BUTTONS.apply,
      ])
    })
  })
})
