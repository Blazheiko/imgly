---
status: Accepted
owner: "Blazheiko"
reviewers: []
updated_at: "2026-10-02"
feature_size: "foundation"
ticket: ""
---

# 0004 — Render adjustments with a WebGL2 shader and the drawing layer with Canvas 2D

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Blazheiko (owner), survey foundation session

## Context

The MVP has six adjustments: brightness, contrast, saturation, temperature/tint, grayscale and sepia.
They need a live slider preview on images up to ~4096 px. Temperature and tint cannot be expressed
with CSS/Canvas `filter`. The freehand brush and eraser draw on a separate layer that is stored on its
own.

## Decision drivers

- Live preview on large images (desktop target).
- Temperature/tint need per-pixel colour math.
- The drawing layer stays separate (brief §7) and the eraser only affects strokes.

## Considered options

1. **WebGL2 fragment shader for adjustments + Canvas 2D for the drawing layer**: GPU speed, with simple raster strokes.
2. **Canvas 2D only, with pixel loops in a Web Worker**: simpler, but laggy at 4096 px.
3. **Canvas 2D `ctx.filter`**: fastest to write, but it cannot do temperature/tint and Safari support is patchy.

## Decision outcome

**Chosen:** Option 1. One shader with one uniform per `AdjustParams` field renders the preview and
the export. The drawing layer is a Canvas 2D bitmap composited on top. The eraser uses
`destination-out` on the layer only.

## Consequences

**Positive**
- Smooth slider preview. A new adjustment is a uniform plus a GLSL block.
- Preview and export share one code path, so what you see is what you export.

**Negative**
- WebGL2 is required. There is no CPU fallback in the MVP, only an "unsupported browser" message.
- GPU output can't be unit-tested in happy-dom, so pixel-level checks live in Playwright e2e.

**Neutral**
- A Worker-based CPU fallback can be added later behind the same `render` interface.

## Links

- Brief: [[../idea-brief.md]] §7
- Map: [[../architecture-map.md]] §Stack, §Constraints
- Related ADR: [[0002-organize-code-as-functional-core-with-feature-folders]]
