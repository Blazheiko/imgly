import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '../adjust'
import type { DrawingLayer, WorkState } from '../document'
import { identityGeometry } from '../geometry'
import { HISTORY_BUDGET_BYTES, HISTORY_MAX_STEPS, heldLayerBytes } from './budget'
import { createHistory, record, undo, type EditHistory } from './history'

type Tool = 'crop-rotate' | 'adjust' | 'draw'

const REFERENCE = { width: 4096, height: 3072 }
const REFERENCE_LAYER_BYTES = 50_331_648
const geometry = identityGeometry(REFERENCE)

let nextId = 0
function layer(size = REFERENCE): DrawingLayer {
  return { id: `l-${nextId++}`, ...size, pixels: {} }
}

function state(revision: number, drawing: DrawingLayer | null = null): WorkState {
  return { geometry, adjustments: NEUTRAL_ADJUSTMENTS, drawing, revision }
}

const steps = (history: EditHistory<Tool>) => history.entries.length - 1

/** Applies `count` drawing Steps, each a new whole-image layer, after `base`. */
function drawSteps(base: WorkState, count: number, size = REFERENCE) {
  let history = createHistory<Tool>(base)
  const evicted = []
  for (let i = 1; i <= count; i++) {
    const result = record(history, 'draw', state(base.revision + i, layer(size)))
    history = result.history
    evicted.push(...result.evicted)
  }
  return { history, evicted }
}

describe('history bounds (undo-redo ADR-0002)', () => {
  it('are 50 Steps and 512 000 000 bytes', () => {
    expect(HISTORY_MAX_STEPS).toBe(50)
    expect(HISTORY_BUDGET_BYTES).toBe(512_000_000)
  })
})

describe('heldLayerBytes', () => {
  it('counts width × height × 4 for each kept layer besides the one the Work shows', () => {
    const { history } = drawSteps(state(0, layer()), 3)

    expect(heldLayerBytes(history)).toBe(3 * REFERENCE_LAYER_BYTES)
  })

  it('does not count the Work’s own layer', () => {
    const { history } = drawSteps(state(0), 1)

    expect(heldLayerBytes(history)).toBe(0)
  })

  it('counts a layer shared by two kept entries once', () => {
    const shared = layer()
    let history = createHistory<Tool>(state(0))
    history = record(history, 'draw', state(1, shared)).history
    history = record(history, 'adjust', state(2, shared)).history
    history = record(history, 'draw', state(3, layer())).history

    expect(heldLayerBytes(history)).toBe(REFERENCE_LAYER_BYTES)
  })

  it('leaves out the layer of the current entry after an Undo, by its id', () => {
    const shared = layer()
    let history = createHistory<Tool>(state(0))
    history = record(history, 'draw', state(1, shared)).history
    history = record(history, 'adjust', state(2, shared)).history
    history = record(history, 'draw', state(3, layer())).history
    history = undo(history)!.history

    expect(heldLayerBytes(history)).toBe(REFERENCE_LAYER_BYTES)
  })

  it('counts Geometry and Adjustments as 0 bytes', () => {
    let history = createHistory<Tool>(state(0))
    for (let i = 1; i <= 5; i++) history = record(history, 'adjust', state(i)).history

    expect(heldLayerBytes(history)).toBe(0)
  })
})

describe('trim inside record (AC-11)', () => {
  it('fits 10 whole-image drawing Steps on the reference Work in 503 316 480 B', () => {
    // Steady state: once the oldest Steps are trimmed, the base entry holds a layer too.
    const { history, evicted } = drawSteps(state(0, layer()), 10)

    expect(steps(history)).toBe(10)
    expect(evicted).toEqual([])
    expect(heldLayerBytes(history)).toBe(503_316_480)
  })

  it('drops the oldest entry on an 11th drawing Step and keeps the newest 10', () => {
    const base = state(0, layer())
    const { history: ten } = drawSteps(base, 10)
    const newest = state(11, layer())

    const { history, evicted } = record(ten, 'draw', newest)

    expect(steps(history)).toBe(10)
    expect(evicted).toEqual([{ state: base, label: null }])
    expect(history.entries[history.cursor]!.state).toBe(newest)
    expect(history.entries[0]!.state.revision).toBe(1)
    expect(heldLayerBytes(history)).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES)
  })

  it('always keeps at least 10 drawing Steps from the open state on', () => {
    const { history, evicted } = drawSteps(state(0), 100)

    expect(steps(history)).toBe(10)
    expect(evicted).toHaveLength(90)
    expect(heldLayerBytes(history)).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES)
  })

  it('keeps all 50 Crop or Adjust Steps', () => {
    let history = createHistory<Tool>(state(0))
    for (let i = 1; i <= 50; i++) {
      const result = record(history, i % 2 ? 'crop-rotate' : 'adjust', state(i))
      history = result.history
      expect(result.evicted).toEqual([])
    }

    expect(steps(history)).toBe(50)
    expect(heldLayerBytes(history)).toBe(0)
  })

  it('drops the oldest on a 51st Crop or Adjust Step', () => {
    const opened = state(0)
    let history = createHistory<Tool>(opened)
    for (let i = 1; i <= 50; i++) history = record(history, 'adjust', state(i)).history

    const { history: after, evicted } = record(history, 'crop-rotate', state(51))

    expect(steps(after)).toBe(50)
    expect(evicted).toEqual([{ state: opened, label: null }])
    expect(after.entries[0]!.state.revision).toBe(1)
    expect(after.cursor).toBe(50)
  })

  it('keeps 7 drawing Steps on a 4096 × 4096 Work', () => {
    const square = { width: 4096, height: 4096 }
    const { history } = drawSteps(state(0, layer(square)), 8, square)

    expect(steps(history)).toBe(7)
    expect(heldLayerBytes(history)).toBe(7 * 67_108_864)
  })

  it('lists the discarded redoable entries before the dropped oldest ones', () => {
    // An Adjust after the 10th drawing shares its layer, so discarding it frees no bytes.
    const base = state(0, layer())
    const { history: ten } = drawSteps(base, 10)
    const shown = ten.entries[ten.cursor]!.state.drawing
    const withAdjust = record(ten, 'adjust', state(11, shown)).history
    const back = undo(withAdjust)!.history
    const discarded = withAdjust.entries[11]!

    const { history, evicted } = record(back, 'draw', state(12, layer()))

    expect(evicted).toEqual([discarded, { state: base, label: null }])
    expect(evicted[0]).toBe(discarded)
    expect(steps(history)).toBe(10)
    expect(heldLayerBytes(history)).toBe(503_316_480)
  })

  it('stays within the budget at every cursor position, down to an opened state with no layer', () => {
    // Back at the opened state the Work shows no layer, so every kept layer is the history's alone.
    let { history } = drawSteps(state(0), 11)

    expect(steps(history)).toBeGreaterThanOrEqual(10)
    for (;;) {
      expect(heldLayerBytes(history)).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES)
      const back = undo(history)
      if (!back) break
      history = back.history
    }
  })

  it('stays within the budget after Undo to a Step whose drawing was cleared', () => {
    const { history: ten } = drawSteps(state(0, layer()), 10)
    let history = record(ten, 'draw', state(11)).history
    history = record(history, 'draw', state(12, layer())).history

    expect(steps(history)).toBeGreaterThanOrEqual(10)
    history = undo(history)!.history

    expect(history.entries[history.cursor]!.state.drawing).toBeNull()
    expect(heldLayerBytes(history)).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES)
  })

  it('never drops the current entry', () => {
    const huge = { width: 20_000, height: 20_000 }
    let history = createHistory<Tool>(state(0, layer(huge)))
    history = record(history, 'draw', state(1, layer(huge))).history
    history = record(history, 'draw', state(2, layer(huge))).history

    expect(history.entries).toHaveLength(1)
    expect(history.cursor).toBe(0)
    expect(history.entries[0]!.state.revision).toBe(2)
  })
})
