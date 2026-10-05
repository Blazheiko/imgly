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
})
