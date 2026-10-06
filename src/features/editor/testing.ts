/**
 * Test-only entry point of the editor feature: stand-ins other modules' tests may use. Production
 * code never imports this (it pulls in Vitest).
 */
export { createFakeRenderer } from './fake-renderer'
