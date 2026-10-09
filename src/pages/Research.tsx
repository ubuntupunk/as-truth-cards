/**
 * The Research Workspace page: the Graph Explorer plus a browser-local research
 * session.
 *
 * Same authoritative projection, same controls, same inspector as `/graph` — the
 * difference is the session rail (`research-workspace-panel.tsx`), which keeps a
 * list of focus pointers so exploration resumes instead of restarting. The
 * session is *not* the account session (ROADMAP §150–166): it lives in
 * `localStorage`, survives sign-in/out untouched, and no account sync is wired
 * yet — the panel says so rather than implying persistence that does not exist.
 */

import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { GRAPH_TREATMENT_TOKENS } from '../graph/appearance'
import { GraphControls } from '../graph/graph-controls'
import { GraphShell } from '../graph/graph-shell'
import { GraphStatusStrip } from '../graph/graph-status'
import { GraphWorkspace } from '../graph/graph-workspace'
import { useGraphPage } from '../graph/use-graph-page'
import {
  entryFromNode,
  entryToGraphParams,
  type ResearchEntry,
} from '../research/research-session'
import { ResearchWorkspacePanel } from '../research/research-workspace-panel'
import { useResearchSession } from '../research/use-research-session'

/**
 * The Research Workspace page.
 *
 * @returns The routed page: shell, controls, session rail, graph canvas and
 * inspector, or the matching state component when there is no usable projection.
 */
const Research = () => {
  const page = useGraphPage()
  const session = useResearchSession()

  const addFocus = () => {
    if (page.focusNode === null) return
    session.add(entryFromNode(page.focusNode, page.params))
  }

  const openEntry = (entry: ResearchEntry) => {
    const target = entryToGraphParams(entry)
    page.setGraphParams({
      focus: target.focus,
      view: target.view,
      depth: target.depth,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-graph-page">
      <Header />

      <div className="flex-grow">
        <GraphShell
          treatment={page.treatment}
          contextLabel="Research Workspace"
          eyebrow="Research / Workspace"
          heading="Research Workspace"
          subtitle="Keep a session of focused entities over the canonical graph."
          controls={
            <GraphControls
              focusInput={page.focusInput}
              onFocusInput={page.onFocusInput}
              onSubmitFocus={page.onFocusSubmit}
              searchResults={page.searchResults}
              searchPending={page.searchPending}
              searchOpen={page.searchOpen}
              onSelectCard={page.onSelectCard}
              onSearchClose={page.onSearchClose}
              views={page.views}
              viewsError={page.viewsError}
              view={page.view}
              onViewChange={(value) => page.updateParam('view', value)}
              maxDepth={page.maxDepth}
              depth={page.depth}
              onDepthChange={(value) =>
                page.updateParam('depth', String(value))
              }
              descriptor={page.selectedDescriptor}
              facets={page.facets.facets}
              filter={page.facets.filter}
              onFacetChange={page.facets.setFilter}
              onClearFacets={page.facets.clear}
              treatment={page.treatment}
              onTreatmentChange={page.setTreatment}
              nodeColors={GRAPH_TREATMENT_TOKENS[page.treatment].nodeColors}
              edgeColors={GRAPH_TREATMENT_TOKENS[page.treatment].edgeColors}
            />
          }
          workspace={
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <ResearchWorkspacePanel
                  entries={session.entries}
                  focus={
                    page.focusNode === null
                      ? null
                      : { id: page.focusNode.id, label: page.focusNode.label }
                  }
                  onAddFocus={addFocus}
                  onOpen={openEntry}
                  onRemove={session.remove}
                  onClear={session.clear}
                />
              </div>
              <GraphWorkspace
                params={page.params}
                projection={page.projection}
                isPending={page.projectionPending}
                error={page.projectionError}
                descriptor={page.selectedDescriptor}
                stylesheet={page.stylesheet}
                facetFilter={page.facets.filter}
                onClearFacets={page.facets.clear}
                onNavigateCard={page.navigateToCard}
                onRefocus={page.refocusEntity}
              />
            </div>
          }
          status={
            <GraphStatusStrip
              projection={page.projection ?? null}
              descriptor={page.selectedDescriptor}
            />
          }
        />
      </div>

      <Footer />
    </div>
  )
}

export default Research
