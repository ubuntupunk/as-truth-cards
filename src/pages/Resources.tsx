/**
 * The Resources page — a curated index of organizations and materials for
 * learning about antisemitism, the Holocaust, and how to respond to bigotry.
 *
 * Distinct from the Sources page (`/sources`), which is the provenance surface
 * for this corpus's claims. Resources are the [external] organisations and
 * publications maintained by other bodies; nothing here is operated by this
 * project, so each link opens in a new tab and the page says so rather than
 * implying endorsement of the orgs' full output.
 */

import Footer from '@/components/Footer'
import Header from '@/components/Header'

/**
 * A single external resource entry on the Resources page.
 */
type ResourceEntry = {
  readonly name: string
  readonly url: string
  readonly summary: string
}

/** Organizations and museums that preserve history and track antisemitism. */
const ORGANIZATIONS: readonly ResourceEntry[] = [
  {
    name: 'United States Holocaust Memorial Museum',
    url: 'https://www.ushmm.org/',
    summary:
      'Museum and research institution dedicated to documenting, studying, and teaching the history of the Holocaust, including its online Holocaust Encyclopedia.',
  },
  {
    name: 'Anti-Defamation League',
    url: 'https://www.adl.org/',
    summary:
      'Civil-rights organization tracking antisemitic incidents and publishing educational backgrounder materials on antisemitic tropes and conspiracies.',
  },
  {
    name: 'American Jewish Committee',
    url: 'https://www.ajc.org/',
    summary:
      'Advocacy organization producing research, translation of antisemitism, and community-facing education on Jewish life and bigotry.',
  },
  {
    name: 'Yad Vashem',
    url: 'https://www.yadvashem.org/',
    summary:
      'The World Holocaust Remembrance Center, holding the largest archive of Holocaust-era testimony and using it for education and commemoration.',
  },
  {
    name: 'Facing History & Ourselves',
    url: 'https://www.facinghistory.org/',
    summary:
      'International education organization whose curricula use history to help students confront bigotry and understand the roots of antisemitism.',
  },
]

/** Research and definitional resources on antisemitism. */
const RESEARCH: readonly ResourceEntry[] = [
  {
    name: 'International Holocaust Remembrance Alliance',
    url: 'https://holocaustremembrance.com/',
    summary:
      'Intergovernmental body whose working definition of antisemitism is a widely used reference point for research, education, and policy.',
  },
  {
    name: 'Holocaust Encyclopedia',
    url: 'https://encyclopedia.ushmm.org/',
    summary:
      'The USHMM’s freely accessible reference work covering the events, people, and ideas of the Holocaust, including the history of antisemitism.',
  },
]

/**
 * The Resources page.
 *
 * @returns The routed page: header, curated external resource index, footer.
 */
const Resources = () => (
  <div className="flex min-h-screen flex-col">
    <Header />

    <main className="flex-grow px-4 pb-16 pt-24">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Learn / Resources
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Resources
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organizations and materials for learning about antisemitism and the
            Holocaust, and for responding to prejudice.
          </p>
        </header>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-foreground">
          <p className="text-muted-foreground">
            This tool is educational. The pages below are maintained by their
            own organizations and are provided for further reading; they open in
            a new tab when you follow them.
          </p>

          <ResourceSection
            title="Organizations & museums"
            entries={ORGANIZATIONS}
          />

          <ResourceSection title="Research & definitions" entries={RESEARCH} />

          <p className="text-xs text-muted-foreground">
            If you have experienced or witnessed an antisemitic incident, your
            local police and civil-rights organizations (such as the{' '}
            <a
              href="https://www.adl.org/report-incident"
              target="_blank"
              rel="noopener noreferrer"
              className="text-graph-accent underline-offset-2 hover:underline"
            >
              ADL incident report
            </a>
            ) can help you report it.
          </p>
        </div>
      </article>
    </main>

    <Footer />
  </div>
)

/**
 * A titled group of external resource links.
 *
 * @param props.title The section heading.
 * @param props.entries The resource entries to list.
 * @returns The heading followed by the link list.
 */
function ResourceSection({
  title,
  entries,
}: {
  title: string
  entries: readonly ResourceEntry[]
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 grid gap-3">
        {entries.map((entry) => (
          <div key={entry.url} className="rounded-xl border border-border p-4">
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-graph-accent underline-offset-4 hover:underline"
            >
              {entry.name}
            </a>
            <p className="mt-1 text-muted-foreground">{entry.summary}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Resources
