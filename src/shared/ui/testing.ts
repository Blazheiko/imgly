// Test helpers for the shared primitives; imported by co-located tests only, never by app code.
import { icons, type IconName } from '../icons'

/** Whether `button` draws the registry icon `name` as its one decorative svg (ui-refresh ADR-0001). */
export function drawsIcon(button: Element, name: IconName): boolean {
  const svgs = button.querySelectorAll('svg')
  if (svgs.length !== 1 || svgs[0]!.getAttribute('aria-hidden') !== 'true') return false
  const first = svgs[0]!.firstElementChild
  const [tag, attrs] = icons[name][0]!
  return (
    first?.tagName.toLowerCase() === tag &&
    Object.entries(attrs).every(([key, value]) => first.getAttribute(key) === value)
  )
}
