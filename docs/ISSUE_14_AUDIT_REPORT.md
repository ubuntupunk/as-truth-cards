# Issue #14 — narrative / three-face verification audit (2026-11-23)

## Scope and boundary

This is a **verification-only audit** of the already-landed Issue #14 narrative
feature. No narrative field, projection, component or face-flow code was
reimplemented. The audit inspected the current tree, added only two missing
test cases for concrete coverage gaps, and ran the repository's available
local gates.

Status vocabulary used below is deliberately separate:

- **implemented** — code/structure exists;
- **locally verified** — a repeatable local command passed;
- **manually verified** — a human/browser observation was made (none in this slice);
- **blocked** — cannot be established in this environment;
- **release-verified** — deployed/production evidence (none in this slice).

Audited tree: local `main` at `77c741ab32e81c357ebc1384f98611f2c6c16f23`, plus
the two test additions in this change. Environment: Node `v24.10.0`, pnpm
`11.8.0`, Linux. No `TROPE_GRAPH_DATABASE_URL` / `DATABASE_URL` was available.

## Data contract and render path

```
trope_graph.cards.editorial_notes
  -> drizzle-reader SELECT ... c.editorial_notes AS "editorialNotes"
  -> CardNode.metadata.editorialNotes
  -> FeaturedCard({ card }) -> CardAnalysis({ narrative })
  -> <section data-testid="analysis-narrative"> ... </section>
```

Evidence: `trope-cards/src/graph/drizzle-reader.ts`,
`trope-cards/src/graph/types.ts`, `src/graph/projection-guards.ts`,
`src/deck/featured-card.tsx`, `src/deck/card-reading.tsx`.

The prose is explicitly labelled as authored editorial analysis and "not
evidence, not a claim, not a source, and not a reasoning step". It is kept out
of the claims / reasoning / sources lists and out of the evidence readout.

## Concrete gaps found and fixed

Both gaps were **test coverage**, not product defects. No production code was
changed.

1. `src/graph/entity-inspector.test.tsx` — the inspector's
   `Editorial analysis (narrative, not evidence)` row had no test. Added a test
   that injects `metadata.editorialNotes` into the card fixture and asserts the
   prose is rendered as a narrative row, that no `evidence_item` node is
   fabricated, and that the shared fixture without notes renders neither the
   row nor an invented placeholder.
2. `src/deck/featured-card.test.tsx` — the face announcement was tested only
   on Analysis. Added a test that renders Cover, Claim and Analysis and asserts
   each announces `Current face: <Face>. Faces: Cover, Claim, Analysis.` so a
   screen reader learns that a third face exists on every stage.

## Criterion-by-criterion evidence

| Criterion | Implementation state | Local evidence | Manual / release status |
|---|---|---|---|
| Narrative field exists in the domain/data model and its origin is known | implemented | `trope-cards/test/graph-projection.test.ts` carries `editorial_notes` verbatim and asserts no notes are invented when absent; new inspector test above | locally verified; no manual DB inspection (blocked) |
| Analysis face leads with real long-form content | implemented | `featured-card.test.tsx` asserts narrative precedes provenance, and that a `# Heading` plus blank-line-separated paragraph renders as heading/paragraph without the `#`; `max-w-prose break-words` in `card-reading.tsx` | locally verified at markup level; browser typography at 375px/desktop not manually verified |
| Distinct from claims, sources, evidence, reasoning | implemented | `card-reading.tsx` keeps the narrative `<section>` outside `CardReadingPanel` and `ProvenancePreview`; caption and new inspector test say "not evidence" | locally verified |
| Honest empty / loading / unavailable states | implemented | `featured-card.test.tsx` asserts explicit "No narrative analysis has been supplied", `Loading reading…`, single projection error state, and that the Cover's `Read analysis` is omitted when the projection failed | locally verified |
| Cover exposes Analysis entry point; Back retains it | implemented | `featured-card.test.tsx` asserts the Cover `Read analysis` calls `onReadAnalysis` without flipping through Claim, and the Claim face's own `Read analysis` handler | locally verified |
| Predictable navigation among all three faces, back to Front/Claim | implemented | `card-actions.tsx` wires `onExamine` / `onReadAnalysis` / `onBackToClaim` / `onClose`; `featured-card.test.tsx` invokes each handler; `src/pages/Deck.tsx` maps them to `showStage('claim' | 'analysis')` and `setOpenStage(null)` | locally verified at component/handler level; full page-level browser walkthrough not manually verified |
| Focus / hidden-face handling | implemented | `featured-card.test.tsx` asserts the inactive face is `inert` + `aria-hidden` and `data-flipped` tracks the stage; new announcement test covers all faces; `Deck.tsx` calls `cardRef.current?.focus()` on non-default stages and the card is `tabIndex={-1}` | partially locally verified; live keyboard tab/focus order not manually verified |
| Reduced-motion and no-3D fallback | implemented | `src/index.css` `@media (prefers-reduced-motion: reduce)` and `@supports not (transform-style: preserve-3d)` remove transforms and swap visibility by `data-flipped` | inspected only; no automated CSS assertion and no browser emulation |
| Narrow (375px) and desktop layouts | implemented | Tailwind responsive classes (`flex-wrap`, `sm:grid-cols-2`, `max-w-prose`, `min-h-[44px]`) inspected in `card-actions.tsx`, `card-reading.tsx`, `card-navigation.tsx` | not viewport-tested; manual visual acceptance remains open under Issue #9 |
| Explore in graph / Save card still work | implemented | `featured-card.test.tsx` asserts `/graph?focus=<slug>` link and Save card disabled with visible account-layer reason | locally verified; live click-through not manually verified |
| Relevant checks run and reported | implemented | Full gate run below | locally verified; graph DB gate blocked |

## Commands and results

Run from the repository root on the audited tree:

| Command | Result |
|---|---|
| `TSX_TSCONFIG_PATH=./tsconfig.app.json node --import tsx --import ./scripts/preact-test-alias.mjs --test src/graph/entity-inspector.test.tsx src/deck/featured-card.test.tsx` | 76 tests, 76 pass, 0 fail |
| `pnpm run test:ui` | 805 tests, 805 pass, 0 fail |
| `pnpm run test:server` | 189 tests, 189 pass, 0 fail |
| `pnpm run trope-graph:test` | 506 tests, 506 pass, 0 fail |
| `pnpm run typecheck` | pass |
| `pnpm run build` | pass |
| `pnpm run lint` | exit 0; 1 warning (see below) |
| `pnpm run trope-graph:validate` | pass with warning `Database checks skipped. Set TROPE_GRAPH_DATABASE_URL to validate evidence rows.` |
| `pnpm run trope-graph:check -- --allow-remote` | **blocked**: `No database connection string found. Set TROPE_GRAPH_DATABASE_URL, or DATABASE_URL to share the host application's connection.` |

Lint warning: `src/sources/research-metrics.tsx:8` has an unused
`ComponentChildren` type import. That file is untouched by this audit; the
warning predates the change and is not a regression. The only product-adjacent
change in this slice is the two test files above (plus this report and the
`ROADMAP.md` evidence row). Biome reports `Found 1 warning` and exits 0.

## Not established by this audit

- No live browser was driven. Responsive layout at 375px and desktop, real
  keyboard tab order, visible focus, reduced-motion emulation and no-3D
  fallback remain **manually unverified**.
- No Figma frame was reconciled in this slice. That acceptance remains open
  with Issue #9 and the 2026-11-23 milestone review.
- No graph integrity / DB check could run without a connection string.
- Nothing here is **release-verified**. Issue #9 stays open; no criterion was
  promoted to release-ready by this audit.

## Conclusion

Issue #14's implementation is present and internally consistent. With the two
added tests, the locally automatable criteria are verified. The remaining
acceptance is browser/DB/provider-dependent and is tracked separately; it must
not be described as complete on the strength of this report.
