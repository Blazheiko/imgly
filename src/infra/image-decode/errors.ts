import type { AppErrorCode } from '@/core'

const READ_REFUSALS = new Set(['NotReadableError', 'NotFoundError', 'SecurityError'])

/** A refused file read is AC-10; anything else the browser throws is a failed decode (AC-08). */
export function mapReadError(name: string): AppErrorCode {
  return READ_REFUSALS.has(name) ? 'FILE_NOT_PERMITTED' : 'DECODE_FAILED'
}

export function errorName(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.name : ''
}
