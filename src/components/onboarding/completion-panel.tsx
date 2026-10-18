import { Button } from '@/components/ui/button'
import type { SetupSummary } from '@/onboarding/wizard'

/**
 * The completion panel shown once onboarding is confirmed by the server — or
 * whenever an already-complete account revisits `/onboarding`.
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved", completion
 * layout (`62:12758`): "Ready to follow the question." with the summary rows
 * Profile / Appearance / Research preferences and the closing research
 * principle. The summary values come from what actually happened (see
 * `buildSetupSummary`), never from optimistic UI.
 */

/** Props for {@link CompletionPanel}. */
export interface CompletionPanelProps {
  /** The account's display name. */
  name: string
  summary: SetupSummary
  onReturn: () => void
  onReviewSettings: () => void
}

/**
 * Render the completion panel.
 *
 * @param props The confirmed summary and destination callbacks.
 * @returns The completion layout.
 */
export const CompletionPanel = ({
  name,
  summary,
  onReturn,
  onReviewSettings,
}: CompletionPanelProps) => (
  <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-md bg-graph-accent/10 px-2 py-1 text-xs font-semibold text-graph-accent">
        Finished setup
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your setup is complete. Optional fields and preferences can be revisited
        in Settings.
      </p>
    </div>

    <div
      className="rounded-xl border border-graph-border bg-graph-surface p-6"
      data-testid="completion-panel"
    >
      <h2 className="text-2xl leading-tight text-foreground">
        Ready to follow the question, {name || 'researcher'}.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Your setup is complete. Optional fields and preferences can be revisited
        in Settings.
      </p>

      <dl className="mt-6 divide-y divide-graph-border rounded-lg border border-graph-border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Profile
          </dt>
          <dd className="text-sm text-foreground" data-testid="summary-profile">
            {summary.profile}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Appearance
          </dt>
          <dd
            className="text-sm text-foreground"
            data-testid="summary-appearance"
          >
            {summary.appearance}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Research preferences
          </dt>
          <dd
            className="text-sm text-foreground"
            data-testid="summary-preferences"
          >
            {summary.researchPreferences}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onReviewSettings}>
          Review Settings
        </Button>
        <Button type="button" onClick={onReturn}>
          Return to the deck →
        </Button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        A completed profile is not research evidence. Email verification and
        researcher status remain separate.
      </p>
    </div>
  </div>
)
