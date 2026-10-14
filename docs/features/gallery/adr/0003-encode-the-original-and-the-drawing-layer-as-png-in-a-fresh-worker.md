---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-14"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0003 — Encode the Original and the Drawing layer as PNG in a fresh worker

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

The Original must be stored without any loss, so that a reopened Work's Export is identical to the one made before the reload (spec §1 ¶4, AC-04, §6). It is an `ImageBitmap` that is oriented, converted to sRGB and at most 4096 px on its long side. The Drawing layer is a 2D `OffscreenCanvas` of the same size (draw ADR-0001). The source file can't be kept instead. CONTEXT says the app never keeps it, and it may carry metadata such as capture location, which spec §6.1 rules out of the stored set. Re-running the decode would also tie the stored Work to every later change in the decode pipeline (AC-18). A Work must be stored within p95 ≤ 3 s of its first Preview without freezing the interface for more than 200 ms (spec §6). A drawing Step must be stored within p95 ≤ 1.5 s. Whether 3 s holds in Firefox and WebKit is spec §8 question 2.

## Decision drivers

- sad.md §1 quality goal 2: 0 difference per channel after reopen, on Chromium, Firefox and WebKit, and across app updates (AC-04, AC-18)
- sad.md §1 quality goal 3: longest freeze ≤ 200 ms, stored within 3 s of open and within 1.5 s of a drawing Step
- spec §6.1: pixels only, with no embedded metadata
- §2: the start-up gate already requires OffscreenCanvas 2D in a worker, and workers sit behind a client factory (export ADR-0002)

## Considered options

1. **PNG, encoded with `OffscreenCanvas.convertToBlob({ type: 'image/png' })` in a fresh worker.**
2. **Raw RGBA compressed with `CompressionStream('gzip')` in a worker**, in an app-specific container: a small header with the size, then the compressed pixels.

## Decision outcome

**Chosen:** Option 1. PNG is the only lossless format that a canvas encodes in all three engines (WebKit can't encode WebP). It is a stable, documented format that any later version of the app or of the browser can decode, and it compresses photos better than generic gzip. Option 2 would bind the app to its own binary format for good, with no gain in exactness: reading the pixels back with `getImageData` goes through the same canvas as Option 1.

How it works:

- A new module, `src/infra/work-codec/`, has `client.ts`, `codec.worker.ts` and `worker-handler.ts`, following the worker convention (§2). Each job runs in a fresh worker that is terminated in every branch, with a timeout far above the §6 targets, as `runInWorker` does for the export.
  - `encodePng(bitmap)` takes a bitmap copy made with `createImageBitmap(...)` and transferred to the worker, draws it into an `OffscreenCanvas` and returns the PNG Blob.
  - `decodePng(blob, expectedSize)` decodes with no colour conversion, no orientation and no resize. It checks the size against the record and transfers the `ImageBitmap` back. A wrong size or a decode failure is a damaged Work (AC-08).
- The Original is encoded once per Work, at its first save, and the Drawing layer once per applied layer id. Draw ADR-0001 gives every applied layer a new id, so the stored layer id tells whether the layer changed. Steps that change only the Geometry or the Adjustments encode nothing.
- Autosave keeps the open Work's encoded Original and layer Blobs in memory until the Work is replaced. A later save can then write them again without re-encoding, when another tab has evicted the Work (AC-21) or when a quota retry needs them (ADR-0004).
- On reopen, the decoded Original becomes the Work's `ImageBitmap`. The decoded layer is drawn into a new layer from `createLayer`, which gives it a new id, and the bitmap is closed with `closeBitmap`. The ledger rules of §2 apply unchanged. Autosave then records the restored layer's new id as the stored layer id and keeps the two loaded PNG Blobs as the open Work's encoded copies. The first Crop or Adjustment Step after a reopen therefore encodes nothing and stays within its 300 ms target.

## Consequences

**Positive**
- The stored bytes are a standard format, inspectable in DevTools and readable by any future version.
- The main thread only copies bitmaps and awaits the result, so encoding never counts against the 200 ms freeze.

**Negative**
- Encoding a 12 MP Original takes roughly half a second to two seconds depending on the engine. This is the open risk behind spec §8 question 2 (§11).
- A canvas holds colours premultiplied by alpha. Semi-transparent pixels of an Original may therefore come back off by one step after a PNG round trip. Opaque pixels, including every photo in the reference set, are exact (§11).
- A PNG of a photo is still about 15–30 MB, which is why the Gallery is capped at 20 Works (repo ADR 0003).

**Neutral**
- The encoded Blobs kept in memory cost roughly their PNG size while the Work is open.

## Amendment (2026-10-14, implementation)

The worker still stores PNG, but it no longer encodes with `OffscreenCanvas.convertToBlob`. Firefox's canvas PNG encoder un-premultiplies with different rounding from `getImageData`, which the Export reads, so every semi-transparent pixel (an Original's alpha and the anti-aliased edges of a Drawing layer) drifted on each save and reopen, by up to 23 per channel. The worker now reads straight RGBA with `getImageData` and writes the PNG itself: a pure 8-bit RGBA writer in `src/core/image-header/png-write.ts` (filter 0) compressed with `CompressionStream('deflate')`. Reopened Works now export with difference 0 on Chromium, Firefox and WebKit, semi-transparent pixels included, so the "off by one step" consequence above no longer holds. Costs: stored PNGs are always RGBA, and with filter 0 only a 12 MP Original encodes about 1.4 s and 30% larger on WebKit (faster and smaller on Chromium and Firefox); per-row filtering can recover size if the byte budget needs it.

## Links

- Spec: [[../spec.md]] AC-04, AC-08, AC-18, AC-21, §6, §6.1, §8 Q2
- SAD: [[../sad.md]] §4, §5, §11
- Related ADR: [[0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores]], [[0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota]]; export ADR-0002 (fresh worker per job); draw ADR-0001 (layer id per applied layer); open-and-view ADR-0004 (sRGB Original)
