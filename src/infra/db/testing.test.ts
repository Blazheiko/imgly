// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { workRecordFixture, storedWorkFixture, damagedWorkFixture } from './testing'

describe('db fixtures', () => {
  it('workRecordFixture builds a valid 4x3 record and honours overrides', () => {
    const r = workRecordFixture({ sourceName: '' })
    expect(r).toMatchObject({
      sourceName: '',
      sourceFormat: 'jpeg',
      width: 4,
      height: 3,
      layerId: null,
      formatVersion: 1,
    })
    expect(r.thumbnail).toBeInstanceOf(Blob)
    expect(workRecordFixture().id).not.toBe(workRecordFixture().id)
  })

  it('storedWorkFixture links record, original and layer by workId', () => {
    const { record, original, layer } = storedWorkFixture()
    expect(original.workId).toBe(record.id)
    expect(layer?.workId).toBe(record.id)
    expect(record.layerId).not.toBeNull()
    expect(original.png.type).toBe('image/png')
  })

  it('storedWorkFixture with layer null sets layerId to null', () => {
    const { record, layer } = storedWorkFixture({ layer: null })
    expect(layer).toBeNull()
    expect(record.layerId).toBeNull()
  })

  it.each([
    'missing-original',
    'layer-without-record-id',
    'size-mismatch',
    'bad-geometry',
    'unknown-format-version',
  ] as const)('damagedWorkFixture(%s) returns a stored Work', (kind) => {
    const w = damagedWorkFixture(kind)
    expect(w.record).toBeDefined()
    if (kind === 'unknown-format-version') expect(w.record.formatVersion).not.toBe(1)
    if (kind === 'missing-original') expect(w.original).toBeNull()
  })
})
