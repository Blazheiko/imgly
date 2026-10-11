/**
 * Test-only entry point of the render layer: stand-ins other modules' tests may use. Production
 * code never imports this.
 */
export {
  createFakeCanvas as createFakeLayerCanvas,
  getPixel,
  setPixel,
} from './drawing/fake-canvas'
export type { FakeCanvas as FakeLayerCanvas } from './drawing/fake-canvas'
