import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { INFO_NOTICE_MS, useNotices } from './index'

describe('useNotices (AC-11b)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('shows every notice of one open together, in order', () => {
    const notices = useNotices()
    notices.pushAll([
      { kind: 'info', text: 'Reduced.' },
      { kind: 'info', text: 'First frame.' },
      { kind: 'info', text: 'Ignored.' },
    ])

    expect(notices.items.map((n) => n.text)).toEqual(['Reduced.', 'First frame.', 'Ignored.'])
  })

  it('adds to the notices already shown instead of replacing them', () => {
    const notices = useNotices()
    notices.pushAll([{ kind: 'failure', text: 'A' }])
    notices.pushAll([{ kind: 'failure', text: 'B' }])

    expect(notices.items.map((n) => n.text)).toEqual(['A', 'B'])
  })

  it('auto-dismisses info after 6000 ms and keeps failures until dismissed', () => {
    const notices = useNotices()
    notices.pushAll([
      { kind: 'info', text: 'Reduced.' },
      { kind: 'failure', text: 'Too large.' },
    ])

    expect(INFO_NOTICE_MS).toBe(6000)
    vi.advanceTimersByTime(5999)
    expect(notices.items).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(notices.items.map((n) => n.text)).toEqual(['Too large.'])

    vi.advanceTimersByTime(60_000)
    expect(notices.items).toHaveLength(1)
  })

  it('dismisses one notice by id', () => {
    const notices = useNotices()
    notices.pushAll([
      { kind: 'failure', text: 'A' },
      { kind: 'failure', text: 'B' },
    ])
    notices.dismiss(notices.items[0]!.id)

    expect(notices.items.map((n) => n.text)).toEqual(['B'])
  })

  it('gives each notice a unique id', () => {
    const notices = useNotices()
    notices.pushAll([
      { kind: 'failure', text: 'A' },
      { kind: 'failure', text: 'A' },
    ])
    const [a, b] = notices.items
    expect(a!.id).not.toBe(b!.id)
  })

  it('returns the new ids in input order (AC-11)', () => {
    const notices = useNotices()
    notices.pushAll([{ kind: 'failure', text: 'Earlier' }])
    const ids = notices.pushAll([
      { kind: 'failure', text: 'A' },
      { kind: 'info', text: 'B' },
    ])

    expect(ids).toHaveLength(2)
    expect(ids).toEqual(notices.items.slice(1).map((n) => n.id))
  })

  it('returns [] and adds nothing for an empty batch', () => {
    const notices = useNotices()
    expect(notices.pushAll([])).toEqual([])
    expect(notices.items).toEqual([])
  })

  it('withdraws a failure notice by its returned id and leaves the others (AC-11)', () => {
    const notices = useNotices()
    const [saveFailed] = notices.pushAll([{ kind: 'failure', text: 'Could not save.' }])
    notices.pushAll([{ kind: 'failure', text: 'Other' }])

    notices.dismiss(saveFailed!)
    expect(notices.items.map((n) => n.text)).toEqual(['Other'])
  })

  it('ignores dismiss for an id that is already gone', () => {
    const notices = useNotices()
    const [id] = notices.pushAll([{ kind: 'info', text: 'Gone soon' }])
    vi.advanceTimersByTime(INFO_NOTICE_MS)
    expect(() => notices.dismiss(id!)).not.toThrow()
    expect(notices.items).toEqual([])
  })

  it('keeps the action on the notice, and the timer still dismisses an info one without running it (AC-08)', () => {
    const notices = useNotices()
    const run = vi.fn()
    notices.pushAll([{ kind: 'info', text: 'Damaged', action: { label: 'Delete…', run } }])
    expect(notices.items[0]!.action?.label).toBe('Delete…')

    vi.advanceTimersByTime(INFO_NOTICE_MS)
    expect(notices.items).toEqual([])
    expect(run).not.toHaveBeenCalled()
  })

  describe('lasting notices (pwa-install-update AC-06)', () => {
    it('never dismisses a lasting notice by itself', () => {
      const notices = useNotices()
      notices.pushAll([{ kind: 'lasting', text: 'A new version of imgly is available.' }])

      vi.advanceTimersByTime(INFO_NOTICE_MS * 100)
      expect(notices.items.map((n) => n.text)).toEqual(['A new version of imgly is available.'])
    })
  })

  describe('slots (pwa-install-update AC-14)', () => {
    it('replaces the notice in an occupied slot in place, keeping its position and the count', () => {
      const notices = useNotices()
      notices.pushAll([{ kind: 'failure', text: 'Before' }])
      notices.pushAll([{ kind: 'lasting', text: 'Available', slot: 'app-update' }])
      notices.pushAll([{ kind: 'failure', text: 'After' }])

      const [id] = notices.pushAll([{ kind: 'lasting', text: 'Elsewhere', slot: 'app-update' }])

      expect(notices.items.map((n) => n.text)).toEqual(['Before', 'Elsewhere', 'After'])
      expect(notices.items[1]!.id).toBe(id)
    })

    it('appends into a slot whose notice was dismissed', () => {
      const notices = useNotices()
      const [id] = notices.pushAll([{ kind: 'lasting', text: 'Available', slot: 'app-update' }])
      notices.dismiss(id!)
      notices.pushAll([{ kind: 'failure', text: 'Other' }])
      notices.pushAll([{ kind: 'lasting', text: 'Again', slot: 'app-update' }])

      expect(notices.items.map((n) => n.text)).toEqual(['Other', 'Again'])
    })

    it('keeps only the later of two same-slot notices in one batch', () => {
      const notices = useNotices()
      notices.pushAll([
        { kind: 'lasting', text: 'First', slot: 'app-update' },
        { kind: 'lasting', text: 'Second', slot: 'app-update' },
      ])

      expect(notices.items.map((n) => n.text)).toEqual(['Second'])
    })

    it("does not let a replaced info notice's timeout dismiss its replacement", () => {
      const notices = useNotices()
      notices.pushAll([{ kind: 'info', text: 'Old', slot: 's' }])
      vi.advanceTimersByTime(INFO_NOTICE_MS - 1)
      notices.pushAll([{ kind: 'lasting', text: 'New', slot: 's' }])

      vi.advanceTimersByTime(INFO_NOTICE_MS * 10)
      expect(notices.items.map((n) => n.text)).toEqual(['New'])
    })

    it('times a slotted replacement by its own kind', () => {
      const notices = useNotices()
      notices.pushAll([{ kind: 'lasting', text: 'Old', slot: 's' }])
      notices.pushAll([{ kind: 'info', text: 'New', slot: 's' }])

      vi.advanceTimersByTime(INFO_NOTICE_MS)
      expect(notices.items).toEqual([])
    })
  })

  describe('update (pwa-install-update AC-11)', () => {
    it('patches a notice in place, keeping its id and position', () => {
      const notices = useNotices()
      const run = vi.fn()
      const [id] = notices.pushAll([
        {
          kind: 'lasting',
          text: 'Available',
          slot: 'app-update',
          action: { label: 'Reload', run },
        },
      ])
      notices.pushAll([{ kind: 'failure', text: 'After' }])

      notices.update(id!, {
        action: { label: 'Reload', run, busy: true, busyLabel: 'Reloading…' },
      })

      expect(notices.items[0]!.id).toBe(id)
      expect(notices.items[0]!.text).toBe('Available')
      expect(notices.items[0]!.action?.busy).toBe(true)
      expect(notices.items.map((n) => n.text)).toEqual(['Available', 'After'])
    })

    it('ignores an update for an id that is gone', () => {
      const notices = useNotices()
      expect(() => notices.update('gone', { text: 'x' })).not.toThrow()
      expect(notices.items).toEqual([])
    })
  })
})
