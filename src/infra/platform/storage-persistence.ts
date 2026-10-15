/** Asks the browser to keep the app's storage. `false` when declined, missing or rejected. AC-14 */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** The browser's current answer, read on every call. `undefined` when the API is missing. AC-13 */
export async function isPersisted(): Promise<boolean | undefined> {
  try {
    return await navigator.storage?.persisted?.()
  } catch {
    return undefined
  }
}
