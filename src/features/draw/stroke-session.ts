import {
  catmullRomSegment,
  deviceToFrame,
  dotSegment,
  footprintReachesCrop,
  type Geometry,
  type Point,
  type Segment,
  type View,
} from '@/core'
import {
  alphaLowered,
  paintDot,
  paintSegment,
  readRect,
  segmentDirtyRect,
  unionRect,
  type BrushStyle,
  type Layer,
  type LayerRect,
} from '@/render'

/** What a Stroke paints into and reports to: the draw store's Draft and the editor. */
export interface StrokeTarget {
  /** The Draft, or null while it is empty. */
  layer(): Layer | null
  /** The Draft, created on the first Brush mark when it is empty (ADR-0001). */
  ensureLayer(): Layer
  isChanged(): boolean
  markChanged(): void
  /** One dirty rectangle per pointer event, for the Preview (`editor.layerChanged`). */
  layerChanged(rect: LayerRect): void
}

/**
 * One Stroke from press to release (draw ADR-0002, sad.md §6 F2/F4). Every reported position,
 * coalesced ones included, is mapped through the View current at its event into the Crop's frame,
 * and consecutive positions are joined by Catmull–Rom segments painted straight into the Draft.
 * The segment behind the newest point is painted once the point after it is known, and the last
 * one on release, so nothing painted ever changes afterwards. Plain fields only: no reactive write
 * happens on the pointer path.
 */
export class StrokeSession {
  private readonly points: Point[] = []
  private ended = false

  constructor(
    private readonly style: BrushStyle,
    private readonly geometry: Geometry,
    private readonly target: StrokeTarget,
  ) {}

  begin(point: Point, view: View) {
    this.points.push(deviceToFrame(view, this.geometry.crop, point))
  }

  /** One pointer event's positions, oldest first. */
  move(points: readonly Point[], view: View) {
    if (this.ended || this.points.length === 0) return
    let dirty: LayerRect | null = null
    for (const p of points) {
      const next = deviceToFrame(view, this.geometry.crop, p)
      const last = this.points[this.points.length - 1]!
      // A repeated position adds a zero-length segment, which canvas engines may drop: a press
      // that never moves would then paint no dot (AC-01, AC-04).
      if (next.x === last.x && next.y === last.y) continue
      this.points.push(next)
      const n = this.points.length
      if (n >= 3) dirty = this.paint(this.segmentEndingAt(n - 2), dirty)
    }
    if (dirty) this.target.layerChanged(dirty)
  }

  /** Release: the last segment, or one dot for a press without movement (AC-01, AC-04). */
  end() {
    if (this.ended || this.points.length === 0) return
    this.ended = true
    const n = this.points.length
    const last = n === 1 ? dotSegment(this.points[0]!) : this.segmentEndingAt(n - 1)
    const dirty = this.paint(last, null)
    if (dirty) this.target.layerChanged(dirty)
  }

  /** The piece from point `i − 1` to point `i`, with the ends as their own missing neighbours. */
  private segmentEndingAt(i: number): Segment {
    const p = this.points
    return catmullRomSegment(p[i - 2] ?? p[i - 1]!, p[i - 1]!, p[i]!, p[i + 1] ?? p[i]!)
  }

  private paint(s: Segment, dirty: LayerRect | null): LayerRect | null {
    const { style, geometry: g, target } = this
    const dot = s.p0 === s.p1 && s.c1 === s.p0 && s.c2 === s.p1
    const draw = (layer: Layer) =>
      dot ? paintDot(layer, s.p0, style, g) : paintSegment(layer, s, style, g)

    if (style.mode === 'brush') {
      // A footprint that never reaches the Crop would be clipped away whole: paint nothing.
      if (!footprintReachesCrop([s], style.width, g.crop)) return dirty
      const rect = draw(target.ensureLayer())
      target.markChanged()
      return unionRect(dirty, rect)
    }

    const layer = target.layer()
    if (!layer) return dirty // the Eraser on an empty Draft changes nothing (ADR-0001)
    if (target.isChanged()) return unionRect(dirty, draw(layer))
    const area = segmentDirtyRect(layer, s, style.width, g)
    const before = readRect(layer, area)
    const rect = draw(layer)
    const after = readRect(layer, area)
    if (before && after && alphaLowered(before, after)) target.markChanged()
    return unionRect(dirty, rect)
  }
}
