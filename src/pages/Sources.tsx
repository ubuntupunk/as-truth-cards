/**
 * The Sources page — the provenance-first surface (ROADMAP §170–200).
 *
 * A canonical bibliography index beside a source's provenance neighbourhood.
 * Selecting a source shows the `evidence` projection focused on it: the source
 * and the claims it is attributed to, read from the same canonical graph every
 * other surface reads. Nothing here is authored, and nothing here upgrades an
 * attribution into verified evidence — the evidence layer is empty in the
 * corpus, and the projection says so rather than hiding it.
 *
 * The page reuses the graph machinery wholesale (shell, workspace, inspector,
 * states, status strip): a source neighbourhood *is* a projection, so inventing
 * a second renderer would be a second vocabulary for the same fact. Only the
 * chrome differs, and the "Open in graph" / "Save to research" actions, which
 * hand the source off to the surfaces that own general exploration and the
 * session.
 */

import { useMemo } from 'preact/hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { EVIDENCE_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'
import { NO_FACET_FILTER } from '../graph/deck-facets'
import { type RefocusTarget, refocusView } from '../graph/entity-inspector'
import { GraphShell } from '../graph/graph-shell'
import { GraphStatusStrip } from '../graph/graph-status'
import { buildGraphStylesheet } from '../graph/graph-stylesheet'
import { GraphWorkspace } from '../graph/graph-workspace'
import type { SourceSummary } from '../graph/projection-guards'
import { type GraphParams, serializeGraphParams } from '../graph/query-params'
import { useGraphProjection, useGraphViews } from '../graph/use-graph'
import { useResearchSession } from '../research/use-research-session'
import { SourceIndexPanel } from '../sources/source-index-panel'
import {
  sourceAttributionParams,
  sourceMetadataLines,
  sourceToResearchEntry,
} from '../sources/source-model'
import { useSources } from '../sources/use-sources'

/** The appearance treatment; the Sources surface does not expose a switcher. */
const SOURCES_TREATMENT = 'atmospheric' as const

/** Graph params that request nothing — used before a source is selected. */
const NO_SOURCE_PARAMS: GraphParams = {
  focus: null,
  view: EVIDENCE_VIEW_NAME,
  depth: null,
}

/**
 * The Sources page.
 *
 * @returns The routed page: source index rail, provenance workspace, and status
 * strip — or the matching honest state when there is no usable projection.
 */
const Sources = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedId = searchParams.get('source')

  const sourcesQuery = useSources()
  const session = useResearchSession()
  const viewsQuery = useGraphViews()

  const params: GraphParams =
    selectedId !== null ? sourceAttributionParams(selectedId) : NO_SOURCE_PARAMS
  const projectionQuery = useGraphProjection(params)

  const descriptor =
    viewsQuery.data?.views.find((view) => view.name === EVIDENCE_VIEW_NAME) ??
    null
  const stylesheet = useMemo(() => buildGraphStylesheet(SOURCES_TREATMENT), [])

  const selectedSource =
    selectedId === null
      ? null
      : (sourcesQuery.data?.items.find((source) => source.id === selectedId) ??
        null)

  const selectSource = (id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('source', id)
    setSearchParams(next)
  }

  const navigateToCard = (slug: string) => {
    navigate(`/graph?focus=${encodeURIComponent(slug)}`)
  }

  const refocus = (id: string, type: RefocusTarget) => {
    navigate(
      `/graph?${serializeGraphParams({
        focus: id,
        view: refocusView(type),
        depth: null,
      })}`,
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-graph-page">
      <Header />

      <div className="flex-grow">
        <GraphShell
          treatment={SOURCES_TREATMENT}
          contextLabel="Sources"
          eyebrow="Provenance / Sources"
          heading="Sources"
          subtitle="The canonical bibliography behind the claims — attribution, not evidence."
          workspace={
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <SourceIndexPanel
                  sources={sourcesQuery.data?.items ?? []}
                  total={sourcesQuery.data?.total ?? 0}
                  isPending={sourcesQuery.isPending}
                  error={sourcesQuery.error}
                  selectedId={selectedId}
                  onSelect={selectSource}
                  onSave={(source) =>
                    session.add(sourceToResearchEntry(source))
                  }
                  isSaved={(id) => session.has(id)}
                />
              </div>

              <div>
                {selectedId === null ? (
                  <SourceWorkspacePrompt />
                ) : (
                  <div className="flex flex-col gap-3">
                    <SourceDetailHeader source={selectedSource} />
                    <GraphWorkspace
                      params={params}
                      projection={projectionQuery.data}
                      isPending={projectionQuery.isPending}
                      error={projectionQuery.error}
                      descriptor={descriptor}
                      stylesheet={stylesheet}
                      facetFilter={NO_FACET_FILTER}
                      onClearFacets={() => {}}
                      onNavigateCard={navigateToCard}
                      onRefocus={refocus}
                    />
                    <div>
                      <Link
                        data-testid="sources-open-graph"
                        to={`/graph?${serializeGraphParams(
                          sourceAttributionParams(selectedId),
                        )}`}
                        className="inline-flex rounded border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Open this source in the Graph Explorer
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
          status={
            selectedId === null ? undefined : (
              <GraphStatusStrip
                projection={projectionQuery.data ?? null}
                descriptor={descriptor}
              />
            )
          }
        />
      </div>

      <Footer />
    </div>
  )
}

/**
 * The no-selection state for the provenance workspace.
 *
 * Deliberately compact: before a source is chosen the workspace has nothing to
 * report, so it points at the index rather than reserving a screen of blank
 * canvas. The status strip is hidden in this state for the same reason.
 *
 * @returns The prompt asking the researcher to choose a source.
 */
function SourceWorkspacePrompt() {
  return (
    <div
      data-testid="sources-prompt"
      className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-graph-border bg-graph-surface p-6 text-center"
    >
      <div className="max-w-md">
        <p className="text-sm font-medium text-foreground">
          Choose a source from the index to trace its provenance
        </p>
        <p className="mt-1 text-xs text-graph-muted-foreground">
          The workspace then shows the source and the claims attributed to it. A
          source is a provenance lead — not evidence for the claim.
        </p>
      </div>
    </div>
  )
}

/**
 * The selected source's metadata header, above its provenance projection.
 *
 * @param props.source The selected source, or `null` before the index loads.
 * @returns The metadata block, or the token-value placeholder while loading.
 */
function SourceDetailHeader({ source }: { source: SourceSummary | null }) {
  if (source === null) {
    return (
      <div
        data-testid="sources-detail-loading"
        className="rounded-xl border border-graph-border bg-graph-surface px-4 py-3 text-xs text-graph-muted-foreground"
      >
        Loading source…
      </div>
    )
  }

  const lines = sourceMetadataLines(source)
  return (
    <section
      data-testid="sources-detail"
      data-source-id={source.id}
      className="rounded-xl border border-graph-border bg-graph-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {source.title}
        </h2>
        <span
          data-testid="sources-detail-attribution"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {source.claimSourceCount} claim attribution
          {source.claimSourceCount === 1 ? '' : 's'}
        </span>
      </div>
      {lines.length > 0 ? (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-graph-muted-foreground">
          {lines.map((line) => (
            <div key={line.label} className="flex gap-1">
              <dt className="font-medium">{line.label}</dt>
              <dd className="min-w-0">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {source.url !== null ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-1 inline-block text-xs text-graph-accent underline-offset-2 hover:underline"
        >
          {source.url}
        </a>
      ) : null}
    </section>
  )
}

export default Sources
