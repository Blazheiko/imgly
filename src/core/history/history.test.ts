import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '../adjust'
import type { WorkState } from '../document'
import { identityGeometry } from '../geometry'
import {
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  redoLabel,
  undo,
  undoLabel,
  type EditHistory,
} from './history'

type Tool = 'crop-rotate' | 'adjust' | 'draw'

const geometry = identityGeometry({ width: 4096, height: 3072 })

function state(revision: number): WorkState {
  return { geometry, adjustments: NEUTRAL_ADJUSTMENTS, drawing: null, revision }
}

const opened = state(0)

/** Records Crop (r1), Adjust (r2) and Draw (r3) after the open state. */
function threeSteps() {
  const s1 = state(1)
  const s2 = state(2)
  const s3 = state(3)
  let history: EditHistory<Tool> = createHistory(opened)
  history = record(history, 'crop-rotate', s1).history
  history = record(history, 'adjust', s2).history
  history = record(history, 'draw', s3).history
  return { history, s1, s2, s3 }
}

describe('createHistory (undo-redo ADR-0001)', () => {
  it('holds only the state at open, with nothing to undo or redo (AC-05)', () => {
    const history = createHistory<Tool>(opened)

    expect(history.entries).toEqual([{ state: opened, label: null }])
    expect(history.cursor).toBe(0)
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
    expect(undoLabel(history)).toBeNull()
    expect(redoLabel(history)).toBeNull()
  })
})

describe('record', () => {
  it('appends the new state, moves the cursor to it and evicts nothing', () => {
    const s1 = state(1)
    const { history, evicted } = record(createHistory<Tool>(opened), 'adjust', s1)

    expect(history.entries).toHaveLength(2)
    expect(history.entries[1]).toEqual({ state: s1, label: 'adjust' })
    expect(history.cursor).toBe(1)
    expect(evicted).toEqual([])
    expect(canUndo(history)).toBe(true)
    expect(undoLabel(history)).toBe('adjust')
  })

  it('discards the redoable entries and returns them as evicted (AC-04)', () => {
    const { history: three, s2, s3 } = threeSteps()
    const back = undo(undo(three)!.history)!.history
    const s4 = state(4)

    const { history, evicted } = record(back, 'draw', s4)

    expect(evicted).toEqual([
      { state: s2, label: 'adjust' },
      { state: s3, label: 'draw' },
    ])
    expect(history.entries.map((e) => e.state.revision)).toEqual([0, 1, 4])
    expect(history.cursor).toBe(2)
    expect(canRedo(history)).toBe(false)
    expect(redoLabel(history)).toBeNull()
    expect(undoLabel(history)).toBe('draw')
  })

  it('never mutates the history it was given', () => {
    const before = createHistory<Tool>(opened)
    record(before, 'adjust', state(1))

    expect(before.entries).toHaveLength(1)
    expect(before.cursor).toBe(0)
  })
})

describe('undo and redo (AC-01, AC-02)', () => {
  it('undo returns the previous state and makes Redo possible', () => {
    const { history, s2 } = threeSteps()

    const result = undo(history)

    expect(result).not.toBeNull()
    expect(result!.state).toBe(s2)
    expect(result!.history.cursor).toBe(2)
    expect(canRedo(result!.history)).toBe(true)
  })

  it('names the tool of the Step each would take back or restore next', () => {
    let history = createHistory<Tool>(opened)
    history = record(history, 'crop-rotate', state(1)).history
    history = record(history, 'adjust', state(2)).history

    expect(undoLabel(history)).toBe('adjust')
    expect(redoLabel(history)).toBeNull()

    history = undo(history)!.history

    expect(undoLabel(history)).toBe('crop-rotate')
    expect(redoLabel(history)).toBe('adjust')
  })

  it('redo returns the very state object that was recorded (exactness)', () => {
    const { history, s3 } = threeSteps()

    const result = redo(undo(history)!.history)

    expect(result!.state).toBe(s3)
    expect(result!.history.cursor).toBe(3)
    expect(canRedo(result!.history)).toBe(false)
  })

  it('walks three Undos back to the open state and three Redos forward again (AC-03)', () => {
    const { history: three, s1, s2, s3 } = threeSteps()
    let history = three
    const undone: WorkState[] = []
    for (let i = 0; i < 3; i++) {
      const result = undo(history)!
      undone.push(result.state)
      history = result.history
    }
    expect(undone).toEqual([s2, s1, opened])
    expect(undone[2]).toBe(opened)
    expect(canUndo(history)).toBe(false)

    const redone: WorkState[] = []
    for (let i = 0; i < 3; i++) {
      const result = redo(history)!
      redone.push(result.state)
      history = result.history
    }
    expect(redone[0]).toBe(s1)
    expect(redone[1]).toBe(s2)
    expect(redone[2]).toBe(s3)
  })

  it('keeps Redo available while undone Steps remain (AC-02)', () => {
    const { history } = threeSteps()
    const twoBack = undo(undo(history)!.history)!.history

    const once = redo(twoBack)!.history

    expect(canRedo(once)).toBe(true)
    expect(redoLabel(once)).toBe('draw')
  })

  it('refuses Undo when every Step is undone, leaving the history unchanged (AC-05)', () => {
    const { history } = threeSteps()
    const start = undo(undo(undo(history)!.history)!.history)!.history

    expect(canUndo(start)).toBe(false)
    expect(undo(start)).toBeNull()
    expect(undoLabel(start)).toBeNull()
    expect(start.cursor).toBe(0)
  })

  it('refuses Redo when nothing has been undone (AC-05)', () => {
    const { history } = threeSteps()

    expect(canRedo(history)).toBe(false)
    expect(redo(history)).toBeNull()
    expect(redoLabel(history)).toBeNull()
  })

  it('never mutates the history on undo or redo', () => {
    const { history } = threeSteps()
    const back = undo(history)!.history
    redo(back)

    expect(history.cursor).toBe(3)
    expect(back.cursor).toBe(2)
  })
})

describe('labels at the oldest kept Step (AC-11)', () => {
  it('names nothing to undo once the bound has dropped the opened state', () => {
    let history = createHistory<Tool>(opened)
    for (let i = 1; i <= 51; i++) history = record(history, 'adjust', state(i)).history
    while (canUndo(history)) history = undo(history)!.history

    expect(history.entries[0]!.label).toBe('adjust')
    expect(undoLabel(history)).toBeNull()
  })
})
