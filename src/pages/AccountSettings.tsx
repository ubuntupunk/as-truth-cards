import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { removeAvatar, uploadAvatar, validateAvatarFile } from '@/auth/avatar'
import { requestEmailChange, validateEmailChange } from '@/auth/change-email'
import { AccountNav } from '@/components/account/account-nav'
import { AvatarPanel } from '@/components/account/avatar-panel'
import { EmailPanel } from '@/components/account/email-panel'
import { PageHeading, PageMain, PageShell } from '@/components/page-shell'
import { ResearchPreferencesPanel } from '@/components/research-preferences-panel'
import { useTreatment } from '@/components/TreatmentProvider'
import { Button } from '@/components/ui/button'
import { GRAPH_TREATMENT_LABELS, type GraphTreatment } from '@/graph/appearance'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { deviceStorage } from '@/lib/device-storage'
import {
  type ParticipationPreferences,
  readParticipationPreferences,
  saveParticipationPreferences,
} from '@/onboarding/preferences'

/**
 * The account settings page — parity with the other account surfaces:
 * the same sidebar, the global treatment zone, and the research-preferences panel
 * the onboarding completion panel's "Review Settings" opens.
 *
 * The panel is where the answers collected in guided setup are actually
 * editable. They are device-local (there is no account column for them, and
 * this project does not invent one), so the page says "stored on this device"
 * rather than implying the account owns them.
 */

/**
 * Settings page: research preferences, appearance, and the profile pointer.
 *
 * @returns The settings route element.
 */
const AccountSettings = () => {
  const { isSignedIn, user, loading, refetch } = useAdminCheck()
  const navigate = useNavigate()
  const [preferences, setPreferences] = useState<ParticipationPreferences>(() =>
    readParticipationPreferences(deviceStorage()),
  )
  const { treatment, setTreatment } = useTreatment()
  const [pendingExit, setPendingExit] = useState<'activity' | 'profile' | null>(
    null,
  )

  /**
   * The email-change form's state. Separate from the avatar block because the two
   * operate on different capabilities and a failure in one must never look like a
   * failure in the other.
   */
  const [emailDraft, setEmailDraft] = useState('')
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  /**
   * The avatar flow's state, one object because every write touches several
   * fields and the setters must never disagree about which operation is in
   * flight. The panel renders this verbatim; the transitions live here.
   */
  const [avatar, setAvatar] = useState<{
    draft: File | null
    draftError: string | null
    busy: 'idle' | 'uploading' | 'removing'
    error: string | null
    status: string | null
  }>({
    draft: null,
    draftError: null,
    busy: 'idle',
    error: null,
    status: null,
  })

  const handleSave = async (
    next: ParticipationPreferences,
    nextTreatment: GraphTreatment,
  ) => {
    saveParticipationPreferences(next, deviceStorage())
    setPreferences(next)
    setTreatment(nextTreatment)
  }

  /**
   * Ask Better Auth to start an email change.
   *
   * Validated locally first so a typo produces no request and no mail. The
   * success line says the link was *requested* and that the change completes only
   * when it is opened — never that the new inbox received anything.
   */
  const handleEmailChange = async () => {
    if (user === null || emailBusy) return

    const problem = validateEmailChange(user.email, emailDraft)
    setEmailFieldError(problem)
    setEmailError(null)
    setEmailStatus(null)
    if (problem !== null) return

    const requested = emailDraft.trim()
    setEmailBusy(true)
    try {
      const accepted = await requestEmailChange(requested)
      if (accepted) {
        setEmailStatus(
          `If ${requested} can receive mail, a verification link is on its way. The change completes only when you open it.`,
        )
        setEmailDraft('')
      } else {
        setEmailError(
          'The server did not accept the request. The address on this account is unchanged.',
        )
      }
    } catch (error) {
      setEmailError(
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'Failed to request the email change',
      )
    } finally {
      setEmailBusy(false)
    }
  }

  /** A file was chosen (or the picker dismissed): hold it and validate it. */
  const handleAvatarChoose = (file: File | null) => {
    setAvatar((current) => ({
      ...current,
      draft: file,
      draftError: file === null ? null : validateAvatarFile(file),
      error: null,
      status: null,
    }))
  }

  /** Upload the held draft, then refresh the session so every surface shows it. */
  const handleAvatarUpload = async () => {
    if (avatar.draft === null || avatar.busy !== 'idle') return
    setAvatar((current) => ({
      ...current,
      busy: 'uploading',
      error: null,
      status: null,
    }))
    try {
      await uploadAvatar(avatar.draft)
      setAvatar((current) => ({
        ...current,
        draft: null,
        draftError: null,
        status: 'Profile photo updated.',
      }))
      // The server pointed `user.image` at the new URL; re-read the session
      // so this page, the Header and the public profile preview agree.
      await refetch()
    } catch (error) {
      setAvatar((current) => ({
        ...current,
        error:
          error instanceof Error && error.message.trim() !== ''
            ? error.message
            : 'Failed to upload image',
      }))
    } finally {
      setAvatar((current) => ({ ...current, busy: 'idle' }))
    }
  }

  /** Remove the stored photo, then refresh so consumers fall back to initials. */
  const handleAvatarRemove = async () => {
    if (avatar.busy !== 'idle') return
    setAvatar((current) => ({
      ...current,
      busy: 'removing',
      error: null,
      status: null,
    }))
    try {
      await removeAvatar()
      setAvatar((current) => ({
        ...current,
        status: 'Profile photo removed.',
      }))
      await refetch()
    } catch (error) {
      setAvatar((current) => ({
        ...current,
        error:
          error instanceof Error && error.message.trim() !== ''
            ? error.message
            : 'Failed to remove image',
      }))
    } finally {
      setAvatar((current) => ({ ...current, busy: 'idle' }))
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageMain>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </PageMain>
      </PageShell>
    )
  }

  if (!isSignedIn || !user) {
    return (
      <PageShell>
        <PageMain>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              You need to be signed in to manage your settings.
            </p>
            <Button
              onClick={() => navigate('/sign-in?returnTo=/account/settings')}
            >
              Sign in
            </Button>
          </div>
        </PageMain>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageMain
        innerClassName="flex flex-col gap-8 md:flex-row md:gap-10"
        innerStyle={{ fontFamily: 'var(--graph-font-family)' }}
      >
        <AccountNav active="settings" />

        <div className="min-w-0 flex-1 space-y-8">
          <PageHeading
            eyebrow="Account / Settings"
            title="Set the terms you work on."
            description="Research preferences are optional and stay on this device.
                Profile, email and sessions stay in your account."
          />

          <EmailPanel
            currentEmail={user.email}
            emailVerified={user.emailVerified}
            value={emailDraft}
            fieldError={emailFieldError}
            busy={emailBusy}
            error={emailError}
            status={emailStatus}
            onChange={(next) => {
              setEmailDraft(next)
              setEmailFieldError(null)
            }}
            onSubmit={handleEmailChange}
          />

          <AvatarPanel
            name={user.name}
            imageUrl={user.image}
            draftFile={avatar.draft}
            draftError={avatar.draftError}
            busy={avatar.busy}
            error={avatar.error}
            status={avatar.status}
            onChoose={handleAvatarChoose}
            onCancelDraft={() =>
              setAvatar((current) => ({
                ...current,
                draft: null,
                draftError: null,
              }))
            }
            onUpload={handleAvatarUpload}
            onRemove={handleAvatarRemove}
          />

          <ResearchPreferencesPanel
            values={preferences}
            treatment={treatment}
            name={user.name}
            summary={{
              profile: user.name,
              appearance: GRAPH_TREATMENT_LABELS[treatment],
              researchPreferences: '',
            }}
            onSave={handleSave}
            onEditProfile={() => navigate('/account')}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
            <Button
              variant="outline"
              onClick={() => setPendingExit('activity')}
            >
              My activity
            </Button>
          </div>
        </div>
      </PageMain>

      {pendingExit ? (
        <div
          role="alertdialog"
          aria-label="Unsaved preferences"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-graph-border bg-graph-surface p-4"
          data-testid="settings-unsaved-prompt"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              You have unsaved preference changes. Leaving discards them.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setPendingExit(null)}>
                Keep editing
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(
                    pendingExit === 'profile'
                      ? '/account'
                      : '/account/activity',
                  )
                }
              >
                Leave and discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default AccountSettings
