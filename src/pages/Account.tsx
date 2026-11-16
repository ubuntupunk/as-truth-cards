import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { updateProfile } from '@/auth/profile'
import { requestVerificationEmail } from '@/auth/verification'
import { AccountNav } from '@/components/account/account-nav'
import { EditProfileForm } from '@/components/account/edit-profile-form'
import { PrivateAccountCard } from '@/components/account/private-account-card'
import { PublicProfileCard } from '@/components/account/public-profile-card'
import { PageHeading, PageMain, PageShell } from '@/components/page-shell'
import { Button } from '@/components/ui/button'
import {
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
  writeGraphTreatment,
} from '@/graph/appearance'
import { authClient, useAdminCheck } from '@/hooks/useAdminCheck'
import { deviceStorage } from '@/lib/device-storage'
import {
  EMPTY_PROFILE_FORM,
  normalizeWebsite,
  type ProfileField,
  type ProfileFieldErrors,
  type ProfileFormValues,
  profileHasErrors,
  validateProfileForm,
} from '@/onboarding/wizard'

/**
 * The account profile page, in parity with "Account / Profile — Atmospheric ·
 * Improved" (`62:13257`): account sidebar, public profile preview, private
 * account card with an honest email-verification state, and the edit-profile
 * section.
 *
 * The "Unverified" label the QA pass flagged is replaced by a real resolution
 * path: an amber "Email not verified" badge plus a resend action backed by
 * Better Auth's existing verification capability — never a fake checkmark.
 * Profile saves go through the server (update-user) and are confirmed by a
 * session refetch before the form closes.
 */

/** Best-effort error message extraction. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : fallback
}

/**
 * Account page: profile preview, private details, verification, appearance.
 *
 * @returns The account route element.
 */
const Account = () => {
  const { isSignedIn, user, loading, role, onboardingComplete, refetch } =
    useAdminCheck()
  const [signingOut, setSigningOut] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_PROFILE_FORM)
  const [formErrors, setFormErrors] = useState<ProfileFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>(
    'idle',
  )
  const [resendError, setResendError] = useState<string | null>(null)
  const [treatment, setTreatment] = useState<GraphTreatment>(() =>
    readGraphTreatment(deviceStorage()),
  )
  const navigate = useNavigate()

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      navigate('/')
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setSigningOut(false)
    }
  }

  const handleEdit = () => {
    if (user === null) return
    setForm({
      name: user.name,
      bio: user.bio ?? '',
      website: user.website ?? '',
      location: user.location ?? '',
    })
    setFormErrors({})
    setSaveError(null)
    setEditing(true)
  }

  const handleFieldChange = (field: ProfileField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFormErrors((previous) => {
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const handleSave = async () => {
    const errors = validateProfileForm(form)
    setFormErrors(errors)
    if (profileHasErrors(errors)) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateProfile({
        name: form.name.trim(),
        bio: form.bio.trim(),
        website: normalizeWebsite(form.website),
        location: form.location.trim(),
      })
      await refetch()
      setEditing(false)
    } catch (err) {
      setSaveError(messageOf(err, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  const handleResend = async () => {
    if (user === null) return
    setResendStatus('sending')
    setResendError(null)
    try {
      await requestVerificationEmail(user.email)
      setResendStatus('sent')
    } catch (err) {
      setResendStatus('idle')
      setResendError(messageOf(err, 'Failed to send the verification email'))
    }
  }

  const handleSelectTreatment = (next: GraphTreatment) => {
    writeGraphTreatment(next, deviceStorage())
    setTreatment(next)
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
              Account
            </h1>
            <p className="text-sm text-muted-foreground">
              You need to be signed in to view this page.
            </p>
            <Button onClick={() => navigate('/sign-in?returnTo=/account')}>
              Sign in
            </Button>
          </div>
        </PageMain>
      </PageShell>
    )
  }

  return (
    <PageShell treatment={treatment} style={graphTreatmentVars(treatment)}>
      <PageMain
        innerClassName="flex flex-col gap-8 md:flex-row md:gap-10"
        innerStyle={{ fontFamily: 'var(--graph-font-family)' }}
      >
        <AccountNav active="profile" />

        <div className="min-w-0 flex-1 space-y-8">
          <PageHeading
            eyebrow="Account / My profile"
            title="Your research identity."
            description="A clear boundary between what you share and what stays in your
                account."
          />

          <div className="flex flex-col gap-6 xl:flex-row">
            <PublicProfileCard
              name={user.name}
              bio={user.bio}
              website={user.website}
              location={user.location}
              imageUrl={user.image}
              accountRole={role}
              onEdit={handleEdit}
            />
            <PrivateAccountCard
              email={user.email}
              emailVerified={user.emailVerified}
              resendStatus={resendStatus}
              resendError={resendError}
              onResend={handleResend}
              treatment={treatment}
              onSelectTreatment={handleSelectTreatment}
            />
          </div>

          {editing ? (
            <EditProfileForm
              values={form}
              errors={formErrors}
              saving={saving}
              error={saveError}
              onFieldChange={handleFieldChange}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <p
              className="text-xs text-muted-foreground"
              data-testid="account-onboarding-status"
            >
              Onboarding: {onboardingComplete ? 'Complete' : 'Not completed'}
            </p>
            <div className="flex flex-wrap gap-3">
              {!onboardingComplete ? (
                <Button
                  variant="outline"
                  onClick={() => navigate('/onboarding')}
                >
                  Finish onboarding
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}

export default Account
