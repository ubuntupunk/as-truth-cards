/**
 * The About page — the project's purpose, educational mission, and where to
 * read further.
 *
 * Uses the shared article layout (eyebrow, `h1`, `text-lg` section headings,
 * `text-muted-foreground` body) that Terms, Privacy, and Resources also use, so
 * the reading surfaces stay one typographic system. The `prose` classes it
 * previously carried were inert — no typography plugin is installed — leaving
 * its headings at the global display size instead of the article scale.
 */

import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'

/**
 * The About page.
 *
 * @returns The routed page: header, mission copy, and footer.
 */
const About = () => (
  <div className="flex min-h-screen flex-col">
    <Header />

    <main className="flex-grow px-4 pb-16 pt-24">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            About / Mission
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Understanding Our Purpose
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Why this educational tool exists and how it approaches antisemitic
            tropes.
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            This educational tool was created to address and debunk common
            misconceptions and harmful stereotypes about Jewish people that have
            persisted throughout history.
          </p>

          <p className="text-muted-foreground">
            By presenting these myths alongside factual corrections, we aim to
            promote understanding, critical thinking, and a more nuanced view of
            complex issues. The cards are designed to expose harmful narratives
            while providing evidence-based context.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Educational Mission
            </h2>
            <p className="text-muted-foreground">
              Our mission is to combat harmful stereotypes through education.
              Each card presents a common antisemitic trope before revealing its
              historical context and factual inaccuracies. This format
              encourages reflection on how these ideas persist and spread.
            </p>
            <p className="text-muted-foreground">
              The card deck format draws inspiration from tarot, but serves as
              an educational tool rather than a predictive one. By making these
              difficult topics approachable, we hope to engage people in
              thoughtful consideration of how stereotypes function and why
              they're harmful.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Sources &amp; Further Reading
            </h2>
            <p className="text-muted-foreground">
              The information presented in these cards is based on historical
              research and contemporary scholarship. We curate organizations and
              materials for learning more on our{' '}
              <Link
                to="/resources"
                className="font-medium text-graph-accent underline-offset-4 hover:underline"
              >
                Resources page
              </Link>
              , including:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>The United States Holocaust Memorial Museum</li>
              <li>The Anti-Defamation League</li>
              <li>The American Jewish Committee</li>
              <li>Academic institutions with Jewish Studies programs</li>
            </ul>
          </section>

          <p className="text-muted-foreground">
            We encourage all users to approach these topics with an open mind
            and a commitment to fighting prejudice in all its forms.
          </p>
        </div>
      </article>
    </main>

    <Footer />
  </div>
)

export default About
