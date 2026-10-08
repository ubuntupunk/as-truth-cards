/**
 * The discovery prompt under the featured card (SPEC §6.4).
 *
 * Question-first and conclusion-free: the card's authored `coreQuestion` (or
 * a neutral "what would you need to check" fallback) is the prompt, and the
 * four lenses — language, place, collective memory, concepts — are offered as
 * further questions rather than as readings of the card. Nothing here asserts
 * what the card concludes, because the prompt's job is to open an enquiry.
 *
 * Pure props → JSX, so the "no manufactured conclusion" rule is testable by
 * asserting the rendered text is all questions.
 */

import type { DiscoveryPromptModel } from './deck-model'

/** Props for {@link DiscoveryPrompt}. */
export type DiscoveryPromptProps = {
  readonly model: DiscoveryPromptModel
}

/**
 * The secondary lens prompt.
 *
 * @param props See {@link DiscoveryPromptProps}.
 * @returns A `<section>` with the primary question and the four lenses.
 */
export function DiscoveryPrompt({ model }: DiscoveryPromptProps) {
  return (
    <section
      data-testid="discovery-prompt"
      aria-label="Discovery prompt"
      className="rounded-xl border border-graph-border bg-graph-surface p-5"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-graph-muted-foreground">
        Look again through another lens
      </h2>
      <p className="mt-2 text-base text-foreground">{model.question}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {model.lenses.map((lens) => (
          <li
            key={lens.label}
            data-lens={lens.label}
            className="rounded-lg border border-graph-border/60 bg-graph-muted/40 p-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-graph-muted-foreground">
              {lens.label}
            </p>
            <p className="mt-1 text-sm text-foreground">{lens.question}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
