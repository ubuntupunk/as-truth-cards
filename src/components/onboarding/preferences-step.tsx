import { Button } from '@/components/ui/button'
import {
  PARTICIPATION_ANSWERS,
  type ParticipationAnswer,
  type ParticipationPreferences,
} from '@/onboarding/preferences'
import {
  ANSWER_LABELS,
  type ParticipationKey,
  type SetupMarker,
} from '@/onboarding/wizard'
import { SetupStrip } from './setup-strip'

/**
 * Setup step 3 — participation ("Participate on your terms.").
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved", preferences
 * step layout (`62:12705`). Both questions default to "Decide later"; answers
 * are device-local until account-level email settings exist, and the panel says
 * so instead of implying the account recorded them.
 */

/** The two questions, in panel order. */
const QUESTIONS: readonly {
  key: keyof ParticipationPreferences
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

/** Props for {@link PreferencesStep}. */
export interface PreferencesStepProps {
  values: ParticipationPreferences
  markers: readonly SetupMarker[]
  finishing: boolean
  onAnswer: (question: ParticipationKey, answer: ParticipationAnswer) => void
  onBack: () => void
  onFinish: () => void
  onSkip: () => void
}

/**
 * Render setup step 3.
 *
 * @param props The current answers and step callbacks.
 * @returns The step-3 layout: context column plus preferences card.
 */
export const PreferencesStep = ({
  values,
  markers,
  finishing,
  onAnswer,
  onBack,
  onFinish,
  onSkip,
}: PreferencesStepProps) => (
  <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-md bg-graph-accent/10 px-2 py-1 text-xs font-semibold text-graph-accent">
        Step 3 of 3
      </span>
      <h2 className="text-2xl leading-tight text-foreground">
        Participate on your terms.
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        None of these choices is required. Decide later without losing access to
        your workspace.
      </p>
    </div>

    <div className="rounded-xl border border-graph-border bg-graph-surface p-6">
      <h3 className="text-xl font-semibold text-foreground">
        Research preferences
      </h3>
      <div className="mt-4">
        <SetupStrip markers={markers} />
      </div>

      <div className="mt-6 space-y-6">
        {QUESTIONS.map((question) => (
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
              {PARTICIPATION_ANSWERS.map((answer) => (
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
                    className="accent-primary"
                  />
                  {ANSWER_LABELS[answer]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Answers are stored on this device until email settings move into your
          account settings.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Participation and profile status are separate from the evidence
          supporting a research claim.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            ← Back: Appearance
          </Button>
          <Button type="button" onClick={onFinish} disabled={finishing}>
            {finishing ? 'Finishing…' : 'Finish setup'}
          </Button>
        </div>
      </div>
    </div>
  </div>
)
