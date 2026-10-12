import type { EditHistory, HistoryEntry } from './history'

/**
 * The Edit history's bound (undo-redo ADR-0002): at most 50 Steps and at most 512 000 000 B of
 * image data (decimal, the stricter reading of "512 MB"). A Step count is `entries.length - 1`.
 */
export const HISTORY_MAX_STEPS = 50
export const HISTORY_BUDGET_BYTES = 512_000_000

/**
 * The bytes of the distinct layers (by `id`) the kept entries hold, leaving out the layer the Work
 * shows (`entries[cursor]`): k Steps then hold at most k layers, so 10 whole-image drawing Steps on
 * the reference Work always fit. Geometry and Adjustments count as 0 bytes.
 */
export function heldLayerBytes(history: EditHistory<unknown, unknown>): number {
  const shown = history.entries[history.cursor]!.state.drawing?.id
  const counted = new Set<string>()
  let bytes = 0
  for (const { state } of history.entries) {
    const layer = state.drawing
    if (!layer || layer.id === shown || counted.has(layer.id)) continue
    counted.add(layer.id)
    bytes += layer.width * layer.height * 4
  }
  return bytes
}

/** Drops the oldest entries while over either bound; the current entry is never dropped. */
export function trim<L, TLayer>(
  history: EditHistory<L, TLayer>,
): { history: EditHistory<L, TLayer>; evicted: HistoryEntry<L, TLayer>[] } {
  let current = history
  const evicted: HistoryEntry<L, TLayer>[] = []
  while (
    current.cursor > 0 &&
    (current.entries.length - 1 > HISTORY_MAX_STEPS ||
      heldLayerBytes(current) > HISTORY_BUDGET_BYTES)
  ) {
    evicted.push(current.entries[0]!)
    current = { entries: current.entries.slice(1), cursor: current.cursor - 1 }
  }
  return { history: current, evicted }
}
