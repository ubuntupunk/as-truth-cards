/**
 * The Graph page: the Graph Explorer over `/api/graph`.
 *
 * Chrome plus two shared pieces. Everything stateful — URL params, the API
 * reads, appearance, facets, focus/descriptor derivation, navigation — lives in
 * `useGraphPage()`, the screen states and the graph + inspector grid live in
 * `graph-workspace.tsx` (shared with the Research Workspace), and the shell and
 * control strip are presentational. This file composes them and computes no
 * graph semantics itself.
 *
 * The appearance switcher repaints the shell and canvas from the chosen
 * treatment's tokens; it never touches the projection, focus, view, depth,
 * selection, or any semantic readout.
 */

import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { GRAPH_TREATMENT_TOKENS } from '../graph/appearance'
import { GraphControls } from '../graph/graph-controls'
import { GraphShell } from '../graph/graph-shell'
import { GraphStatusStrip } from '../graph/graph-status'
import { GraphWorkspace } from '../graph/graph-workspace'
import { useGraphPage } from '../graph/use-graph-page'

/**
 * The Graph page.
 *
 * @returns The routed page: shell, controls, graph canvas and inspector, or
 * the matching state component when there is no usable projection.
 */
const Graph = () => {
  const page = useGraphPage()

  return (
    <div className="flex min-h-screen flex-col bg-graph-page">
      <Header />

      <div className="flex-grow">
        <GraphShell
          treatment={page.treatment}
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

export default Graph
