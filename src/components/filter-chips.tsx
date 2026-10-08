/**
 * The filter-chip primitives shared by every filter strip in the product.
 *
 * The Deck's scope badges and Explore's facet filters are the same control
 * wearing different labels: a `<fieldset>`/`<legend>` group (the legend is the
 * group's real accessible name, and a set of filters *is* a form control group
 * semantically) holding single-select toggle badges with `aria-pressed`. Both
 * surfaces already followed that pattern; it lives here so a third surface
 * cannot quietly invent a different one.
 *
 * What these must never do: invent a filter. The values each strip offers come
 * from the cards actually loaded ({@link availableAxes} and friends), so an
 * axis no card carries is not offered as a control that can only ever return
 * nothing.
 */

import type { ComponentChildren } from 'preact'
import { cn } from '@/lib/utils'

/** The muted, compact badge shell shared by every chip in a strip. */
export const CHIP_BADGE =
  'inline-flex min-h-[34px] items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'

/** Props for {@link FilterGroup}. */
export type FilterGroupProps = {
  /** The group's visible name, rendered as its `<legend>`. */
  readonly label: string
  readonly children: ComponentChildren
}

/**
 * One group of filter chips.
 *
 * @param props See {@link FilterGroupProps}.
 * @returns A `<fieldset>` whose legend names the group.
 */
export function FilterGroup({ label, children }: FilterGroupProps) {
  return (
    <fieldset className="m-0 border-0 p-0" data-filter-group={label}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </fieldset>
  )
}

/** Props for {@link ToggleBadge}. */
export type ToggleBadgeProps = {
  /** Whether this value is the active selection. */
  readonly active: boolean
  /** Reports a selection; clearing is the caller's decision (re-click clears). */
  readonly onSelect: () => void
  readonly children: ComponentChildren
}

/**
 * One toggle badge. Active state is carried by `aria-pressed` and text weight.
 *
 * @param props See {@link ToggleBadgeProps}.
 * @returns A toggle `<button>` with the shared chip treatment.
 */
export function ToggleBadge({ active, onSelect, children }: ToggleBadgeProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        CHIP_BADGE,
        active
          ? 'border-foreground/30 bg-foreground text-background'
          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
