/**
 * A pixel-backed stand-in for an `OffscreenCanvas` with a 2D context, for unit tests in happy-dom
 * (which has no Canvas 2D). It keeps real RGBA pixels for the calls the layer module makes and
 * records every other call. Test-only: nothing in production imports this.
 */
export interface FakeCanvas {
  width: number
  height: number
  /** RGBA, row-major, `width × height × 4`. */
  pixels: Uint8ClampedArray
  /** The options the context was first asked for. */
  contextOptions: unknown
  calls: [string, ...unknown[]][]
  getContext(kind: '2d', options?: unknown): FakeContext2d
}

export type FakeContext2d = Record<string, unknown> & {
  canvas: FakeCanvas
  getImageData(x: number, y: number, w: number, h: number): ImageData
  putImageData(image: ImageData, x: number, y: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  drawImage(source: FakeCanvas, x: number, y: number): void
}

/** Sets one pixel of a fake canvas; for arranging marks in tests. */
export function setPixel(canvas: FakeCanvas, x: number, y: number, rgba: number[]) {
  canvas.pixels.set(rgba, (y * canvas.width + x) * 4)
}

export function getPixel(canvas: FakeCanvas, x: number, y: number): number[] {
  const i = (y * canvas.width + x) * 4
  return [...canvas.pixels.subarray(i, i + 4)]
}

export function createFakeCanvas(width: number, height: number): FakeCanvas {
  let pixels = new Uint8ClampedArray(width * height * 4)
  let ctx: FakeContext2d | undefined
  const calls: [string, ...unknown[]][] = []

  const canvas: FakeCanvas = {
    get width() {
      return width
    },
    set width(w: number) {
      width = w
      pixels = new Uint8ClampedArray(width * height * 4)
    },
    get height() {
      return height
    },
    set height(h: number) {
      height = h
      pixels = new Uint8ClampedArray(width * height * 4)
    },
    get pixels() {
      return pixels
    },
    contextOptions: undefined,
    calls,
    getContext(_kind, options) {
      if (ctx) return ctx
      canvas.contextOptions = options
      const base = {
        canvas,
        getImageData(x: number, y: number, w: number, h: number) {
          calls.push(['getImageData', x, y, w, h])
          const data = new Uint8ClampedArray(w * h * 4)
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const sx = x + col
              const sy = y + row
              if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
              const from = (sy * width + sx) * 4
              data.set(pixels.subarray(from, from + 4), (row * w + col) * 4)
            }
          }
          return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData
        },
        putImageData(image: ImageData, x: number, y: number) {
          calls.push(['putImageData', x, y])
          for (let row = 0; row < image.height; row++) {
            for (let col = 0; col < image.width; col++) {
              const dx = x + col
              const dy = y + row
              if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue
              const from = (row * image.width + col) * 4
              pixels.set(image.data.subarray(from, from + 4), (dy * width + dx) * 4)
            }
          }
        },
        clearRect(x: number, y: number, w: number, h: number) {
          calls.push(['clearRect', x, y, w, h])
          for (let row = Math.max(0, y); row < Math.min(height, y + h); row++) {
            pixels.fill(
              0,
              (row * width + Math.max(0, x)) * 4,
              (row * width + Math.min(width, x + w)) * 4,
            )
          }
        },
        drawImage(source: FakeCanvas, x: number, y: number) {
          calls.push(['drawImage', source, x, y])
          if (x === 0 && y === 0 && source.width === width && source.height === height) {
            pixels.set(source.pixels)
          }
        },
      }
      ctx = new Proxy(base as FakeContext2d, {
        get(target, prop) {
          if (prop in target) return target[prop as string]
          return (...args: unknown[]) => {
            calls.push([String(prop), ...args])
          }
        },
        set(target, prop, value) {
          target[prop as string] = value
          calls.push([`set ${String(prop)}`, value])
          return true
        },
      })
      return ctx
    },
  }
  return canvas
}
