import { describe, expect, it } from 'vitest'
import { continueGifWalk, GIF_WALK_MIN_CHUNK, startGifWalk, type GifWalk } from './index'
import { bytes, gif } from './test-fixtures'

/** Feeds the rest of the file from `walk.offset` in `size`-byte chunks, as the worker does. */
function walkInChunks(file: Uint8Array, walk: GifWalk, size: number): GifWalk {
  while (!walk.done && walk.frames < 2 && walk.offset < file.length) {
    const next = continueGifWalk(walk, file.subarray(walk.offset, walk.offset + size))
    if (next.offset === walk.offset && !next.done) return next
    walk = next
  }
  return walk
}

describe('GIF block walk past the header window (AC-11)', () => {
  const two = gif({ width: 8, height: 8, frames: 2 })

  it('finds both frames when the window holds the whole file', () => {
    expect(startGifWalk(two)).toMatchObject({ frames: 2, done: true })
  })

  it('stops at the window edge with one frame and resumes to find the second', () => {
    // Every cut after the logical screen, so the window edge splits every kind of block.
    for (let cut = 20; cut < two.length; cut++) {
      const window = two.subarray(0, cut)
      const start = startGifWalk(window)
      for (const size of [GIF_WALK_MIN_CHUNK, 11, 13, 64]) {
        expect(walkInChunks(two, start, size).frames, `cut ${cut}, chunks of ${size}`).toBe(2)
      }
    }
  })

  it('walks a long run of sub-blocks without reading their contents', () => {
    const big: number[] = []
    for (let n = 0; n < 5000; n++) big.push(255, ...new Array<number>(255).fill(0xaa))
    const one = gif({ width: 8, height: 8 })
    // Splice 5000 data sub-blocks into the first frame, then append a second frame.
    const firstData = one.length - 6 // [2] [3, …] [0] [0x3b]: before the 3-byte sub-block
    const file = bytes(
      one.subarray(0, firstData),
      big,
      one.subarray(firstData, one.length - 1),
      two.subarray(two.length - 25),
    )
    const start = startGifWalk(file.subarray(0, 1 << 20))
    expect(start).toMatchObject({ frames: 1, done: false })
    expect(walkInChunks(file, start, 1 << 20)).toMatchObject({ frames: 2, done: true })
  })

  it('ends at the trailer with one frame for a still GIF', () => {
    const one = gif({ width: 8, height: 8 })
    expect(walkInChunks(one, startGifWalk(one.subarray(0, 30)), GIF_WALK_MIN_CHUNK)).toMatchObject({
      frames: 1,
      done: true,
    })
  })

  it('makes no progress, and claims no frame, when the file ends inside a block', () => {
    const cut = two.subarray(0, two.length - 20) // inside the second frame's control extension
    const walk = walkInChunks(cut, startGifWalk(cut.subarray(0, 40)), GIF_WALK_MIN_CHUNK)
    expect(walk).toMatchObject({ frames: 1, done: false })
    expect(continueGifWalk(walk, new Uint8Array(0))).toEqual(walk)
  })

  it('stops at a byte that starts no block', () => {
    const junk = bytes(two.subarray(0, two.length - 25), [0x99, 0x2c])
    expect(
      walkInChunks(junk, startGifWalk(junk.subarray(0, 40)), GIF_WALK_MIN_CHUNK),
    ).toMatchObject({
      frames: 1,
      done: true,
    })
  })
})
