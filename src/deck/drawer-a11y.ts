/**
 * Drawer focus management for the below-`xl` workspace rails (SPEC §4.7).
 *
 * The drawers must behave as true modal dialogs for keyboard and assistive
 * users: focus is trapped inside while open, the rest of the page is inert so
 * it cannot be reached by Tab or pointer, and focus returns to the control that
 * opened the drawer on dismissal. The DOM work lives here so `DeckWorkspace`
 * can stay a pure, hook-free presentational component.
 */

/** Elements that can receive keyboard focus inside a dialog, in tab order. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Whether a Tab press should wrap focus back to the opposite end of the dialog.
 *
 * Pure so it can be unit-tested without a DOM. `count` is the number of
 * focusable items, `index` the active item's position (`-1` when focus is
 * outside the dialog), and `shift` whether Shift+Tab was pressed.
 *
 * @param count Number of focusable items inside the dialog.
 * @param index Index of the currently focused item, or `-1` if none.
 * @param shift Whether the Tab was backwards (`Shift+Tab`).
 * @returns `true` when the key handler should wrap (and prevent default).
 */
export function shouldWrapTab(
  count: number,
  index: number,
  shift: boolean,
): boolean {
  if (count <= 0) return true
  if (index < 0) return true
  return shift ? index === 0 : index === count - 1
}

/** The tabbable elements inside `root`, in document order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.offsetParent !== null)
}

/**
 * Confine Tab/Shift+Tab navigation to `dialog`.
 *
 * @param dialog The open dialog element.
 * @param event The keydown event to inspect and, on wrap, consume.
 * @returns `true` if the event was handled (default prevented).
 */
export function trapTab(dialog: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== 'Tab') return false
  const items = focusableWithin(dialog)
  const active = document.activeElement as HTMLElement | null
  const index = active ? items.indexOf(active) : -1
  if (shouldWrapTab(items.length, index, event.shiftKey)) {
    event.preventDefault()
    const target = event.shiftKey ? items[items.length - 1] : items[0]
    target?.focus()
    return true
  }
  return false
}

/**
 * Mark every branch of the tree beside `layer` as `inert`, so pointer and
 * keyboard interaction cannot reach the background while a drawer is open.
 * The dialog layer itself (backdrop + dialog) is left interactive.
 *
 * @param layer The dialog-layer element to preserve.
 * @returns A function that removes exactly the `inert` attributes it added.
 */
export function inertBackground(layer: HTMLElement): () => void {
  const inerted: HTMLElement[] = []
  let node: HTMLElement | null = layer
  while (node) {
    const parent = node.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node) continue
      if (!(sibling instanceof HTMLElement)) continue
      if (sibling.hasAttribute('inert')) continue
      sibling.setAttribute('inert', '')
      inerted.push(sibling)
    }
    node = parent
  }
  return () => {
    for (const element of inerted) element.removeAttribute('inert')
  }
}
