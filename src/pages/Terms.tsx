/**
 * The Terms page — the conditions under which the Trope Cards research tool is
 * offered.
 *
 * The terms are deliberately narrow and restate the same epistemic boundary the
 * application itself enforces: this is an illustrative research collection, not
 * a source of established historical conclusions. Nothing here grants rights to
 * the underlying sources, which remain the property of their authors.
 */

import Footer from '@/components/Footer'
import Header from '@/components/Header'

/** The date these terms were last revised. */
const LAST_UPDATED = '11 October 2026'

/**
 * The Terms page.
 *
 * @returns The routed page: header, terms of use, footer.
 */
const Terms = () => (
  <div className="flex min-h-screen flex-col">
    <Header />

    <main className="flex-grow px-4 pb-16 pt-24">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Legal / Terms
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Terms of Use
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {LAST_UPDATED}.
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            By using Trope Cards you agree to these terms. If you do not agree,
            please do not use the tool.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Educational and research purpose
            </h2>
            <p className="text-muted-foreground">
              Trope Cards is provided for educational and research purposes. It
              is an illustrative research collection: the claims, source leads,
              and inferences it presents are unverified, and it does not
              establish historical conclusions. You should not treat any content
              as a settled factual finding.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              No warranty
            </h2>
            <p className="text-muted-foreground">
              The tool is provided "as is", without warranties of any kind,
              express or implied, including accuracy, completeness, or fitness
              for a particular purpose. Content may be incomplete and is under
              active revision.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Acceptable use
            </h2>
            <p className="text-muted-foreground">
              You agree not to misuse the tool, including by attempting to
              disrupt it, gain unauthorised access, or use it to harass others
              or to promote hate. Do not present the tool's content as
              established fact or as endorsement of any claim it catalogs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Accounts and authored drafts
            </h2>
            <p className="text-muted-foreground">
              If you create an account, you are responsible for keeping your
              credentials secure. Draft decompositions you author are your
              participation data, are stored against your account, and do not
              become canonical research content. You should not submit content
              you do not have the right to submit.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Intellectual property
            </h2>
            <p className="text-muted-foreground">
              Sources referenced by the tool remain the property of their
              respective authors and publishers. Attribution in the Sources
              surface is a provenance lead, not a grant of rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Limitation of liability
            </h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by law, we are not liable for any
              loss or damage arising from your use of, or reliance on, the tool
              or its content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Changes to these terms
            </h2>
            <p className="text-muted-foreground">
              The tool and these terms may change over time. Continued use after
              a change constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms can be raised in the project's issue
              tracker.
            </p>
          </section>
        </div>
      </article>
    </main>

    <Footer />
  </div>
)

export default Terms
