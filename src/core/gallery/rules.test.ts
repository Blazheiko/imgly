import { describe, expect, it } from 'vitest'
import { GALLERY_CAP, entryName, evictionCandidates, storageLine, touchedLabel } from './rules'

interface Rec {
  id: string
  touchedAt: number
}

const rec = (id: string, touchedAt: number): Rec => ({ id, touchedAt })

/** n records r01..rNN, r01 the oldest. */
function records(n: number): Rec[] {
  return Array.from({ length: n }, (_, i) => rec(`r${String(i + 1).padStart(2, '0')}`, 1000 + i))
}

const none = { keep: null, damaged: new Set<string>(), extra: 0 }

describe('GALLERY_CAP', () => {
  it('is 20', () => {
    expect(GALLERY_CAP).toBe(20)
  })
})

describe('evictionCandidates', () => {
  it('returns [] when there is room (19 stored)', () => {
    expect(evictionCandidates(records(19), none)).toEqual([])
  })

  it('returns [] for an empty Gallery', () => {
    expect(evictionCandidates([], none)).toEqual([])
  })

  it('returns the oldest of the others when 20 are stored and one is open', () => {
    expect(evictionCandidates(records(20), { ...none, keep: 'r01' })).toEqual(['r02'])
  })

  it('returns the oldest overall when 20 are stored and none is open', () => {
    expect(evictionCandidates(records(20), none)).toEqual(['r01'])
  })

  it('evicts the Work just replaced when it is the only candidate (AC-09)', () => {
    const result = evictionCandidates([rec('open', 1), rec('replaced', 2)], {
      keep: 'open',
      damaged: new Set(),
      extra: 1,
    })

    expect(result).toEqual(['replaced'])
  })

  it('never returns keep, even when it is the only stored Work and extra is 1', () => {
    expect(
      evictionCandidates([rec('only', 1)], { keep: 'only', damaged: new Set(), extra: 1 }),
    ).toEqual([])
  })

  it('adds extra evictions on top of what the cap needs', () => {
    expect(evictionCandidates(records(19), { ...none, extra: 1 })).toEqual(['r01'])
    expect(evictionCandidates(records(20), { ...none, extra: 2 })).toEqual(['r01', 'r02', 'r03'])
  })

  it('never returns more than there are candidates', () => {
    expect(evictionCandidates(records(3), { ...none, extra: 10 })).toEqual(['r01', 'r02', 'r03'])
  })

  it('picks damaged Works first, even when newer', () => {
    expect(evictionCandidates(records(20), { ...none, damaged: new Set(['r15']) })).toEqual(['r15'])
  })

  it('with all damaged except keep, evicts damaged first, oldest first', () => {
    const all = records(20)
    const damaged = new Set(all.filter((r) => r.id !== 'r10').map((r) => r.id))

    expect(evictionCandidates(all, { keep: 'r10', damaged, extra: 2 })).toEqual([
      'r01',
      'r02',
      'r03',
    ])
  })

  it('orders damaged before undamaged, then by age', () => {
    expect(
      evictionCandidates(records(20), { ...none, damaged: new Set(['r18', 'r17']), extra: 2 }),
    ).toEqual(['r17', 'r18', 'r01'])
  })

  it('breaks equal touchedAt by the lower id, regardless of input order', () => {
    const tied = [rec('b', 100), rec('c', 100), rec('a', 100)]
    const full = [...tied, ...records(17).map((r) => rec(r.id, r.touchedAt + 1000))]

    expect(evictionCandidates(full, none)).toEqual(['a'])
    expect(evictionCandidates([...full].reverse(), { ...none, extra: 2 })).toEqual(['a', 'b', 'c'])
  })

  it('does not count an already stored incoming id twice, and never returns it', () => {
    const all = records(20)

    expect(evictionCandidates(all, { ...none, incoming: 'r01' })).toEqual([])
    expect(evictionCandidates(all, { ...none, incoming: 'r05', extra: 1 })).toEqual(['r01'])
    expect(evictionCandidates(all, { ...none, incoming: 'r01', extra: 1 })).toEqual(['r02'])
  })

  it('does not mutate its input', () => {
    const all = records(20)
    const copy = structuredClone(all)
    evictionCandidates(all, none)

    expect(all).toEqual(copy)
  })

  it('property: keep is never picked and the Gallery ends at most 20', () => {
    let seed = 12345
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let run = 0; run < 300; run++) {
      const n = Math.floor(rand() * 22) // 0..21
      const recs = Array.from({ length: n }, (_, i) =>
        rec(`id${String(i).padStart(2, '0')}`, Math.floor(rand() * 5)),
      )
      const keep = n > 0 && rand() < 0.7 ? recs[Math.floor(rand() * n)]!.id : null
      const damaged = new Set(recs.filter(() => rand() < 0.4).map((r) => r.id))
      const extra = rand() < 0.3 ? 1 : 0

      const result = evictionCandidates(recs, { keep, damaged, extra })

      expect(result).not.toContain(keep)
      expect(new Set(result).size).toBe(result.length)
      expect(result.every((id) => recs.some((r) => r.id === id))).toBe(true)
      expect(n - result.length + 1).toBeLessThanOrEqual(GALLERY_CAP)
      const flags = result.map((id) => damaged.has(id))
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)))
    }
  })
})

describe('entryName', () => {
  it("gives 'Untitled' for an empty name", () => {
    expect(entryName('')).toBe('Untitled')
  })

  it('returns any other name unchanged', () => {
    expect(entryName('holiday.jpg')).toBe('holiday.jpg')
  })
})

describe('touchedLabel', () => {
  const now = Date.UTC(2026, 5, 15, 12, 0, 0)
  const S = 1000
  const MIN = 60 * S
  const H = 60 * MIN

  it.each([
    ['0 s', 0, 'Just now'],
    ['59 s', 59 * S, 'Just now'],
    ['60 s', 60 * S, '1 minute ago'],
    ['59 min', 59 * MIN, '59 minutes ago'],
    ['60 min', 60 * MIN, '1 hour ago'],
    ['23 h 59 min', 23 * H + 59 * MIN, '23 hours ago'],
  ])('%s ago reads %s', (_name, delta, expected) => {
    expect(touchedLabel(now - delta, now, 'en-US')).toBe(expected)
  })

  it('uses the medium date in the given locale from 24 h on', () => {
    const touched = now - 24 * H

    expect(touchedLabel(touched, now, 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(touched),
    )
    expect(touchedLabel(touched, now, 'de-DE')).toBe(
      new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(touched),
    )
  })
})

describe('touchedLabel with an unusable touchedAt (T34, R2-1)', () => {
  it.each([
    ['NaN', NaN],
    ['missing', undefined as unknown as number],
    ['null', null as unknown as number],
    ['string', '2026-06-15' as unknown as number],
    ['Infinity', Infinity],
    ['below the date range', -1e17],
    ['above the date range', 1e17],
  ])('a %s touchedAt has no label and never throws', (_l, bad) => {
    expect(touchedLabel(bad, Date.UTC(2026, 5, 15), 'en-US')).toBe('')
  })
})

describe('storageLine', () => {
  it('maps true to persisted', () => {
    expect(storageLine(true)).toBe('persisted')
  })

  it('maps false to not-persisted', () => {
    expect(storageLine(false)).toBe('not-persisted')
  })

  it('maps undefined (API missing) to not-persisted', () => {
    expect(storageLine(undefined)).toBe('not-persisted')
  })
})

describe('evictionCandidates with an unusable touchedAt (T25, S1-2)', () => {
  const unusable: [string, number][] = [
    ['NaN', NaN],
    ['missing', undefined as unknown as number],
    ['above the date range', 1e17],
    ['below the date range', -1e17],
  ]

  it.each(unusable)('a %s touchedAt sorts as the oldest and is evicted first', (_l, bad) => {
    const recs = [...records(19), rec('zz-bad', bad)]

    expect(evictionCandidates(recs, { ...none, extra: 1 })).toEqual(['zz-bad', 'r01'])
  })

  it.each(unusable)('with a %s touchedAt the result does not depend on input order', (_l, bad) => {
    const base = [...records(19), rec('m-bad', bad)]
    const orders = [base, [...base].reverse(), [base[10]!, ...base.slice(0, 10), ...base.slice(11)]]
    for (const recs of orders) {
      expect(evictionCandidates(recs, { ...none, extra: 2 })).toEqual(['m-bad', 'r01', 'r02'])
    }
  })

  it('two NaN records order by id, after nothing is lost', () => {
    const recs = [rec('b', NaN), rec('a', NaN), ...records(18)]

    expect(evictionCandidates(recs, { ...none, extra: 1 })).toEqual(['a', 'b'])
  })
})
