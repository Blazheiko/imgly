---
slug: gallery
date: 2026-10-15
triage: regression
acs: [AC-04]
commit: the commit with trailer SDD-Fix: 2026-10-15-linux-webkit-reopen-inexact
recurrence_of: none
---

# Fix: on Linux WebKit, a reopened Work with semi-transparent pixels no longer exports identically

## Symptom

In CI (`ubuntu-24.04`, Playwright 1.63 WebKit), reopening a Work from the Gallery should give a
full-size Export identical to the Export made before the reload (difference 0 per channel). It came
out as much as 4 off. Four tests in `e2e/gallery/save-and-reopen.spec.ts` failed, all of them Works
with a Drawing layer: lines 273 and 320 (`photo.png`) and line 297 (`alpha-patches.png`,
`soft-edge.png`). Chromium, Firefox and macOS WebKit passed, so the local ship run on 2026-10-15
missed it. It affects every Work reopened on Linux WebKit (GTK/WPE browsers such as Epiphany)
whose Drawing layer or Original has semi-transparent pixels. It reproduced locally in the CI's
image, `mcr.microsoft.com/playwright:v1.63.0-noble`.

## Root cause

The worker decoded the stored PNG with `createImageBitmap(blob, { premultiplyAlpha: 'none' })`
(`src/infra/work-codec/worker-handler.ts`). On reopen, the layer bitmap was drawn into the new
layer canvas (`src/features/editor/store.ts`, `reopenWork`). The Export reads the Original back
through a 2D canvas. WebKit on Linux doesn't keep the unpremultiplied state through that path. A
probe on Linux WebKit found:

- An unpremultiplied bitmap drawn into a 2D canvas read back as much as **232** off, while
  `putImageData` of the same straight bytes read back exactly.
- A semi-transparent Original with no drawing reopened **4** off, so the Original was affected too,
  not only the layer.

The opaque `photo.png` failed only because of its antialiased drawing. This is the decode-side twin
of `c289bcf`, which made the encode side independent of the canvas encoder for Firefox. Three gaps
let it through:

- Every semi-transparent e2e case also had a drawing, so the Original cause was hidden behind the
  layer cause.
- No local engine shows the behaviour.
- The unit fakes accept any decode options.

## The pinning test

- **e2e (new):** `AC-04: a reopened Work exports identically › alpha-patches.png with no drawing
  reopens exactly, alpha included`, plus the same for `soft-edge.png`. Run on Linux WebKit without
  the fix, both failed on the exactness assertion:
  > `Error: per channel, alpha included … Expected: 0 Received: 4` (and `Received: 7`)
- **e2e (existing):** the four CI failures reproduced on Linux WebKit with `Received: 2` to `4`.
- **Unit:** `worker-handler.test.ts` checks that a PNG the app wrote decodes through `putImageData`
  and never `createImageBitmap`. It first failed with:
  > `AssertionError: expected [ { …(3) } ] to deeply equal []` (the `createImageBitmap` options
  > were recorded)
- **Unit:** `core/image-header/png-read.test.ts` (round trip, all five filter types, other shapes,
  broken bytes) and `work-codec/png-decode.test.ts` (round trip with `encodeRgbaPng`, `'other'`,
  `'damaged'`).

After the fix, `e2e/gallery` passes on Linux WebKit (37 passed, 3 Chromium-only skipped) and on
macOS Chromium, Firefox and WebKit (114 passed, 6 skipped).

## Spec patch

None. The spec was right: AC-04 and the §6 row "Exactness of a reopened Work … on Chromium, Firefox
and WebKit" already require difference 0 on every engine. AC-04 was re-verified on Linux WebKit.
ADR-0003's `decodePng` bullet gets a dated amendment for the new decode path, and the test plan
lists the new tests.

## Follow-ups

- The decode path for PNGs of other shapes still uses `createImageBitmap(…, 'none')`. Only test
  hooks write such PNGs today (fixture files in the AC-18 and cap tests). Their pixels are opaque,
  so Linux WebKit stays exact there.
- The e2e CI matrix is the only place Linux WebKit runs. A local `pnpm test:e2e` on macOS can't
  catch an engine-specific rounding like this one. Consider documenting the Docker command used here
  (see PR #10) in the test plan.
- The Preview path (`uploadTexture` of an `ImageBitmap`) wasn't compared here. The export uploads
  `ImageData`, which is what AC-04 measures.
