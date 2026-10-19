import { useState } from 'preact/hooks'
import { AppearanceSelector } from '@/components/appearance-selector'
import { Button } from '@/components/ui/button'
import type { GraphTreatment } from '@/graph/appearance'
import type {
  ParticipationAnswer,
  ParticipationPreferences,
} from '@/onboarding/preferences'
import { ANSWER_LABELS, type ParticipationKey } from '@/onboarding/wizard'

/**
 * The editable research preferences, tabbed by category so the completion
 * panel's "Review Settings" and the account Settings page can offer the same
 * thing without either surface inventing its own form.
 *
 * Two properties are deliberate:
 *
 * - **Edits stage, then save.** A radio click only updates local state; nothing
 *   is persisted until the user presses Save. That is what makes the
 *   "discard your unsaved changes?" prompt on navigation truthful rather than a
 *   guess about which click was the last one.
 * - **The Appearance tab is the same control as everywhere else.** It renders
 *   {@link AppearanceSelector} over the device-local treatment, so there is one
 *   appearance UI, not three.
 *
 * The panel never claims an account owns these answers: they are stored on this
 * device and saved from this device (see `onboarding/preferences.ts`).
 */

/** The two tabs, in the order the Figma completion summary lists them. */
export const SETTINGS_TABS = ['profile', 'appearance', 'preferences'] as const

/** One selectable tab of the research-preferences panel. */
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** Tab labels as shown on the tab strip. */
export const SETTINGS_TAB_LABELS: Readonly<Record<SettingsTab, string>> = {
  profile: 'Profile',
  appearance: 'Appearance',
  preferences: 'Research preferences',
}

/** One tab's summary of what is currently selected. */
export interface SettingsSummary {
  /** The current display name, or empty when none is set. */
  profile: string
  /** The current appearance label (from `GRAPH_TREATMENT_LABELS`). */
  appearance: string
  /** The current research-preferences answer label. */
  researchPreferences: string
}

/** The two research-preference questions, in panel order. */
export const SETTINGS_QUESTIONS: readonly {
  key: ParticipationKey
  legend: string
  prompt: string
}[] = [
  {
    key: 'feedbackEmail',
    legend: 'Feedback-related email',
    prompt: 'Would you like to receive email about feedback you contribute?',
  },
  {
    key: 'academicParticipation',
    legend: 'Academic participation',
    prompt:
      'Would you like to explore academic feedback and participation options? Choosing yes is an expression of interest, not a credential.',
  },
]

/** Props for {@link ResearchPreferencesPanel}. */
export interface ResearchPreferencesPanelProps {
  /** The device-stored answers to edit. */
  values: ParticipationPreferences
  /** The device-stored appearance to edit. */
  treatment: GraphTreatment
  /** The account's current display name, for the profile hint. */
  name: string
  /** The preference/orientation summary, or `null` to omit the section. */
  summary: SettingsSummary | null
  /** Persists the staged values; the panel stays mounted while it resolves. */
  onSave: (
    next: ParticipationPreferences,
    treatment: GraphTreatment,
  ) => Promise<void>
  /** Navigates to the profile editor, when the host has one. */
  onEditProfile?: () => void
}

/**
 * Render the research-preferences panel rows.
 *
 * @param props The staged answers and the change callback.
 * @returns The question fieldsets, or a note when no question needs an answer.
 */
const QuestionFields = ({
  values,
  onAnswer,
}: {
  values: ParticipationPreferences
  onAnswer: (question: ParticipationKey, answer: ParticipationAnswer) => void
}) => (
  <>
    {SETTINGS_QUESTIONS.map((question) => (
      <fieldset
        key={question.key}
        className="space-y-2 rounded-lg border border-graph-border p-4"
        data-testid={`preference-${question.key}`}
      >
        <legend className="text-sm font-semibold text-foreground">
          {question.legend}
        </legend>
        <p className="text-sm text-muted-foreground">{question.prompt}</p>
        <div className="flex flex-wrap gap-4 pt-1">
          {(['yes', 'no', 'later'] as const).map((answer) => (
            <label
              key={answer}
              className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
            >
              <input
                type="radio"
                name={question.key}
                value={answer}
                checked={values[question.key] === answer}
                onChange={() => onAnswer(question.key, answer)}
                className="accent-graph-accent"
              />
              {ANSWER_LABELS[answer]}
            </label>
          ))}
        </div>
      </fieldset>
    ))}
  </>
)

/**
 * Render the tabbed research-preferences panel.
 *
 * @param props The device-local values, the summary, and the save/edit seams.
 * @returns The panel with one visible tab, or the saved status once persisted.
 */
export const ResearchPreferencesPanel = ({
  values,
  treatment,
  name,
  summary,
  onSave,
  onEditProfile,
}: ResearchPreferencesPanelProps) => {
  const [tab, setTab] = useState<SettingsTab>('preferences')
  const [loaded, setLoaded] = useState<{
    values: ParticipationPreferences
    treatment: GraphTreatment
  }>(() => ({ values, treatment }))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  // The host may hand over fresher device values after a save elsewhere (the
  // onboarding wizard writes them too). Track them so the tab strip summary
  // never shows a stale label, without clobbering staged edits.
  const [seen, setSeen] = useState({ values, treatment })
  if (seen.values !== values || seen.treatment !== treatment) {
    setSeen({ values, treatment })
    setLoaded({ values, treatment })
    setStatus('idle')
  }

  const handleAnswer = (
    question: ParticipationKey,
    answer: ParticipationAnswer,
  ) => {
    setError(null)
    setStatus('idle')
    setLoaded((previous) => ({
      ...previous,
      values: { ...previous.values, [question]: answer },
    }))
  }

  const handleSave = async () => {
    setStatus('saving')
    setError(null)
    try {
      await onSave(loaded.values, loaded.treatment)
      setStatus('saved')
    } catch (err) {
      setStatus('idle')
      setError(
        err instanceof Error && err.message.trim() !== ''
          ? err.message
          : 'Failed to save your preferences',
      )
    }
  }

  const currentSummary: SettingsSummary = {
    profile: name.trim() || 'Not added',
    appearance: summary?.appearance ?? '',
    researchPreferences: `${ANSWER_LABELS[values.feedbackEmail]} · ${ANSWER_LABELS[values.academicParticipation]}`,
  }

  return (
    <section
      className="rounded-xl border border-graph-border bg-graph-surface p-6"
      data-testid="preferences-panel"
    >
      <h2 className="text-xl font-semibold text-foreground">
        Research preferences
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guided setup asks three optional questions. Everything here is optional,
        and it is not research evidence.
      </p>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="mt-5 inline-flex flex-wrap gap-1 rounded-lg border border-graph-border bg-graph-muted/40 p-1"
        data-testid="settings-tabs"
      >
        {SETTINGS_TABS.map((entry) => {
          const selected = entry === tab
          return (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(entry)}
              className={
                selected
                  ? 'rounded-md bg-graph-surface px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
              }
            >
              {SETTINGS_TAB_LABELS[entry]}
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        {tab === 'profile' ? (
          <div className="space-y-3" data-testid="settings-tab-profile">
            <p className="text-sm text-muted-foreground">
              The display name on your public profile.
            </p>
            <p className="text-sm text-foreground">
              {name.trim() || 'Not added'}
            </p>
            {onEditProfile ? (
              <Button type="button" variant="outline" onClick={onEditProfile}>
                Edit profile
              </Button>
            ) : null}
          </div>
        ) : null}

        {tab === 'appearance' ? (
          <div className="space-y-4" data-testid="settings-tab-appearance">
            <p className="text-sm text-muted-foreground">
              How the graph and account surfaces read.
            </p>
            <AppearanceSelector
              value={loaded.treatment}
              onSelect={(next) => {
                setStatus('idle')
                setError(null)
                setLoaded((previous) => ({ ...previous, treatment: next }))
              }}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Stored on this device, not on your account.
            </p>
          </div>
        ) : null}

        {tab === 'preferences' ? (
          <div className="space-y-4" data-testid="settings-tab-preferences">
            <QuestionFields values={loaded.values} onAnswer={handleAnswer} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Answers are stored on this device until email settings move into
              your account settings.
            </p>
          </div>
        ) : null}
      </div>

      {summary ? (
        <dl
          className="mt-6 divide-y divide-graph-border rounded-lg border border-graph-border"
          data-testid="settings-summary"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profile
            </dt>
            <dd className="text-sm text-foreground">
              {currentSummary.profile}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Appearance
            </dt>
            <dd className="text-sm text-foreground">
              {currentSummary.appearance}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Research preferences
            </dt>
            <dd className="text-sm text-foreground">
              {currentSummary.researchPreferences}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : 'Save preferences'}
        </Button>
        {status === 'saved' ? (
          <p
            role="status"
            className="text-sm text-muted-foreground"
            data-testid="preferences-saved"
          >
            Saved on this device.
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm text-destructive"
          data-testid="preferences-error"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
