/** A window looks for a new version at most once per this interval while it is visible. AC-15 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Whether a window should look for a new version now: on start when visible, never while hidden,
 * and once 60 minutes have passed since the last check (a failed check counts). A clock moved
 * backwards waits until 60 minutes after `lastCheck`. AC-15
 */
export function nextCheckDue(lastCheck: number | null, now: number, visible: boolean): boolean {
  if (!visible) return false
  return msUntilNextCheck(lastCheck, now) === 0
}

/** The delay until the next check is due, for a visible window's timer: 0 at start. */
export function msUntilNextCheck(lastCheck: number | null, now: number): number {
  if (lastCheck === null) return 0
  return Math.max(0, lastCheck + UPDATE_CHECK_INTERVAL_MS - now)
}
