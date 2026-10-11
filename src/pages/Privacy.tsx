/**
 * The Privacy page — a factual account of what the running application stores
 * and where it goes.
 *
 * The copy is an audit, not a template: every claim below corresponds to code
 * that was read, and the `localStorage` keys are imported from the modules that
 * own them so the policy cannot drift from the implementation. Where the
 * application has no capability (third-party analytics, advertising trackers,
 * request-logging middleware), the page says so explicitly rather than leaving
 * the reader to infer it. Nothing here promises more than the code does.
 */

import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { GRAPH_TREATMENT_STORAGE_KEY } from '@/graph/appearance'
import { RESEARCH_SESSION_STORAGE_KEY } from '@/research/research-session'

/** The date this policy's statements were last verified against the code. */
const LAST_UPDATED = '11 October 2026'

/**
 * The Privacy page.
 *
 * @returns The routed page: header, audited data-flow policy, footer.
 */
const Privacy = () => (
  <div className="flex min-h-screen flex-col">
    <Header />

    <main className="flex-grow px-4 pb-16 pt-24">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Legal / Privacy
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Privacy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {LAST_UPDATED}.
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            Trope Cards is an educational research tool for studying antisemitic
            tropes and the claims attached to them. This page describes, as
            accurately as the current code allows, what the application stores,
            where it is stored, and what is deliberately not collected.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Stored in your browser only
            </h2>
            <p className="text-muted-foreground">
              The following are kept in your browser's{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                localStorage
              </code>{' '}
              and are never sent to our servers:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Your light/dark theme preference (stored under the key{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  theme
                </code>
                ).
              </li>
              <li>
                Your research session — the list of canonical entities you have
                focused while exploring — stored under{' '}
                <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
                  {RESEARCH_SESSION_STORAGE_KEY}
                </code>
                . This working state is separate from your account and is not
                synced to one.
              </li>
              <li>
                Your Graph Explorer appearance choice, stored under{' '}
                <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
                  {GRAPH_TREATMENT_STORAGE_KEY}
                </code>
                .
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Account data, if you create an account
            </h2>
            <p className="text-muted-foreground">
              Authentication is provided by Better Auth. If you create an
              account with an email address and password, we store:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>your name and email address;</li>
              <li>a password hash (never your plaintext password);</li>
              <li>
                an account role and any optional profile fields you provide
                (bio, website, location);
              </li>
              <li>
                session records, which include the IP address and user-agent
                string of the device that signed in and an expiry time.
              </li>
            </ul>
            <p className="text-muted-foreground">
              This data is stored in a PostgreSQL database (hosted on Neon).
              Better Auth sets a session cookie when you sign in so the server
              can recognise your session; no advertising or cross-site tracking
              cookies are used.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Content you author
            </h2>
            <p className="text-muted-foreground">
              Draft claim decompositions you save from the Compose surface are
              stored against your account. They are participation data only:
              they never become part of the canonical research collection, and
              no one else is shown them as canonical work.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Service providers
            </h2>
            <p className="text-muted-foreground">
              The application relies on two infrastructure providers:{' '}
              <strong>Render</strong> hosts the Express server and the static
              site, and <strong>Neon</strong> hosts the PostgreSQL database
              described above. No other third-party services are used — there is
              no analytics, advertising, email, or CDN provider in the running
              application.
            </p>
            <p className="text-muted-foreground">
              These providers may retain their own infrastructure and access
              logs (for example, HTTP access logs at the platform edge, or
              database connection logs) independently of the application, under
              their respective policies. This page describes what the
              application itself does; it cannot attest to, and makes no claim
              about, logs kept by those providers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              What we do not do
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                The application includes no third-party analytics, advertising,
                or tracking scripts.
              </li>
              <li>
                The application performs no request logging of its own: the
                server registers no logging middleware, and its only output is a
                single startup line plus, on failure, an error stack written to
                standard error. It does not write request bodies, query strings,
                or IP addresses to any application-managed log. Provider-side
                logs are addressed under “Service providers” above.
              </li>
              <li>We do not sell your personal data.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Your choices
            </h2>
            <p className="text-muted-foreground">
              You can clear the browser-local data at any time by clearing this
              site's storage in your browser settings; the research session and
              preferences will simply reset. If you would like account data
              corrected or removed, please contact us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Changes to this policy
            </h2>
            <p className="text-muted-foreground">
              Because this is an actively developed research tool, what is
              stored may change. Material changes will be reflected here with an
              updated date.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy can be raised in the project's issue
              tracker.
            </p>
          </section>
        </div>
      </article>
    </main>

    <Footer />
  </div>
)

export default Privacy
