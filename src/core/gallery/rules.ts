/** The Gallery holds at most this many Works. AC-03, AC-09 */
export const GALLERY_CAP = 20

export interface EvictionRecord {
  id: string
  touchedAt: number
}

export interface EvictionOptions {
  /** The Work open in this tab; never returned. AC-07 */
  keep: string | null
  /** Ids of Works that can't be read in full; evicted first. AC-08 */
  damaged: ReadonlySet<string>
  /** Further Works to evict on top of what the cap needs (quota retry). ADR-0004 */
  extra: number
  /**
   * The id of the Work being written. When it is already stored it is not counted twice and is
   * never returned, because the write replaces it.
   */
  incoming?: string
}

/** A touchedAt that is missing or not a finite number counts as the oldest possible. */
function touchedKey(r: { touchedAt: unknown }): number {
  return typeof r.touchedAt === 'number' && Number.isFinite(r.touchedAt) ? r.touchedAt : -Infinity
}

/** A total order, oldest first: an unusable touchedAt first, then by touchedAt, the id breaking ties. */
export function compareOldestFirst(
  a: { id: string; touchedAt: unknown },
  b: { id: string; touchedAt: unknown },
): number {
  const ka = touchedKey(a)
  const kb = touchedKey(b)
  if (ka !== kb) return ka < kb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Ids to evict so that at most GALLERY_CAP Works remain once the incoming Work is written, plus
 * `extra` more. Damaged first, then the oldest `touchedAt`, the id breaking ties. Never `keep`.
 */
export function evictionCandidates(
  records: readonly EvictionRecord[],
  { keep, damaged, extra, incoming }: EvictionOptions,
): string[] {
  const others = records.filter((r) => r.id !== incoming)
  const overflow = Math.max(0, others.length + 1 - GALLERY_CAP)
  const wanted = overflow + Math.max(0, extra)
  if (wanted === 0) return []

  return others
    .filter((r) => r.id !== keep)
    .sort((a, b) => {
      const damage = Number(damaged.has(b.id)) - Number(damaged.has(a.id))
      if (damage !== 0) return damage
      return compareOldestFirst(a, b)
    })
    .slice(0, wanted)
    .map((r) => r.id)
}

/** The name an entry shows; a nameless Work reads "Untitled". AC-03 */
export function entryName(sourceName: string): string {
  return sourceName === '' ? 'Untitled' : sourceName
}

/**
 * When a Work was last opened or changed, relative under a day, else the date. AC-03
 * A damaged record's touchedAt may be anything; it gets no label rather than a throw (AC-08).
 */
export function touchedLabel(touchedAt: number, now: number, locale?: string): string {
  if (typeof touchedAt !== 'number' || !Number.isFinite(touchedAt)) return ''
  const seconds = Math.floor((now - touchedAt) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(touchedAt)
}

/** Which storage line the Gallery shows; an absent API counts as not persisted. AC-13 */
export function storageLine(persisted: boolean | undefined): 'persisted' | 'not-persisted' {
  return persisted === true ? 'persisted' : 'not-persisted'
}
