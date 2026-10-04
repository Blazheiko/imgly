/**
 * A recording stand-in for WebGL2RenderingContext, for unit tests in happy-dom (which has no
 * WebGL). Test-only: nothing in production imports this.
 */
export interface FakeGl {
  gl: WebGL2RenderingContext
  calls: [string, ...unknown[]][]
  names(): string[]
}

export function createFakeGl(): FakeGl {
  const calls: [string, ...unknown[]][] = []
  let nextId = 1
  const created = (kind: string) => ({ kind, id: nextId++ })
  const returns: Record<string, (...args: unknown[]) => unknown> = {
    createShader: () => created('shader'),
    createProgram: () => created('program'),
    createTexture: () => created('texture'),
    createBuffer: () => created('buffer'),
    createVertexArray: () => created('vao'),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_p, name) => ({ uniform: name }),
    getAttribLocation: () => 0,
    isContextLost: () => false,
  }
  const gl = new Proxy({} as Record<string | symbol, unknown>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      if (/^[A-Z0-9_]+$/.test(prop)) return prop
      return (...args: unknown[]) => {
        calls.push([prop, ...args])
        return returns[prop]?.(...args)
      }
    },
  }) as unknown as WebGL2RenderingContext
  return { gl, calls, names: () => calls.map(([name]) => name) }
}

export function createFakeCanvas(gl: WebGL2RenderingContext | null) {
  const listeners = new Map<string, ((event: Event) => void)[]>()
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
    addEventListener: (type: string, fn: (event: Event) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    removeEventListener: (type: string, fn: (event: Event) => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((f) => f !== fn),
      )
    },
    dispatch(type: string): Event {
      const event = new Event(type, { cancelable: true })
      for (const fn of listeners.get(type) ?? []) fn(event)
      return event
    },
  }
  return canvas
}

export function createFakeFrames() {
  let queue: (() => void)[] = []
  return {
    requestFrame: (fn: () => void) => {
      queue.push(fn)
      return queue.length
    },
    cancelFrame: () => {
      queue = []
    },
    get pending() {
      return queue.length
    },
    flush() {
      const run = queue
      queue = []
      for (const fn of run) fn()
    },
  }
}
