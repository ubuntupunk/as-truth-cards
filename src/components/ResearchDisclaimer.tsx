/**
 * `ResearchDisclaimer` — the epistemic disclaimer every research surface must
 * show, in one place so the wording cannot drift between them.
 *
 * The copy is the approved wording and claims exactly as much as the data
 * supports: the collection is illustrative, its claims and source leads are
 * unverified, and no historical conclusions are established. It was previously
 * private to `graph-shell.tsx`; the Sources and Research surfaces received it
 * through that shell, while Decks rendered without it. Extracting it here lets
 * Decks mount the identical statement directly.
 *
 * The component is presentational only: no graph state, no data. Callers supply
 * a `className` for their surface's colour tokens and spacing, so the graph
 * surfaces can keep their treatment-driven chrome while Decks uses the standard
 * theme tokens — the *wording* is shared, not the palette.
 */

import { cn } from '@/lib/utils'

/**
 * The research disclaimer.
 *
 * @param props.className Surface-specific colour tokens and spacing. The
 * component supplies the border, radius, padding, and text size.
 * @returns The disclaimer block, tagged `research-disclaimer`.
 */
export function ResearchDisclaimer({ className }: { className?: string }) {
  return (
    <div
      data-testid="research-disclaimer"
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        className ?? 'border-border bg-muted text-muted-foreground',
      )}
    >
      <span className="mr-1.5 font-semibold text-foreground">
        Research disclaimer
      </span>
      Illustrative research collection. Claims, source leads, and inferences are
      unverified; no historical conclusions are established.
    </div>
  )
}
