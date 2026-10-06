Phase complete: **Cytoscape presentation adapter** over the canonical graph projections, committed as `3e9300f` (adapter in `4ac66d9`). Treating `1476558` as accepted; no corpus or Concept decision reopened.

`Postgres/Drizzle → projection ({nodes, edges, meta}) → Graphology (optional) → Cytoscape`

## Files added / changed

| File | Change |
|---|---|
| `trope-cards/src/graph/cytoscape-adapter.ts` | **new** — the adapter (518 lines) |
| `trope-cards/test/cytoscape-adapter.test.ts` | **new** — 55 tests (1108 lines) |
| `package.json`, `pnpm-lock.yaml` | `cytoscape` `^3.34.3` |
| `trope-cards/docs/GRAPH_PROJECTION_DESIGN.md` | §6 pipeline, §13 record, new "Cytoscape presentation layer" + full mapping table |
| `trope-cards/docs/ADR_GRAPH_LAYER.md` | §3.2/§3.3 boundary, §8 version, §9 step 6 |
| `.beads/issues.jsonl` | new issue `as-truth-cards-2bq` |

**Cytoscape version/API:** `3.34.3`, flat `ElementDefinition[]` per the official notation format.

**devDependency, not dependency** — the adapter's only import is `import type { NodeDefinition, EdgeDefinition } from 'cytoscape'`, and only the tests need the runtime. Nothing shipped requires the library, so the client bundle is unchanged (276.55 kB) and `cytoscape` appears nowhere in `dist/assets`. It should be promoted when UI code imports the core.

## Exact domain → Cytoscape mapping

Copy-only. Nothing derived except `classes`.

| Domain | Cytoscape | Notes |
|---|---|---|
| `GraphNode.id` | `data.id` | canonical uuid, never rewritten |
| `GraphNode.type` / `label` | `data.type` / `data.label` | verbatim, no truncation |
| `GraphNode.depth` / `isFocus` / `degree` | same names | the projection's own numbers, not recomputed |
| `GraphNode.status` | `data.status` | incl. the `source` tag, so Q4's decoupling survives |
| `CardNode.classification` | `data.classification` | **card only**; key genuinely absent elsewhere |
| `GraphNode.metadata` | `data.metadata` | type-specific bag, verbatim |
| `GraphEdge.id` | `data.id` | the deterministic `buildEdgeId` composite |
| `GraphEdge.from` / `to` | `data.source` / `data.target` | authored direction, never swapped |
| `GraphEdge.family` | `data.family` | kept separate from `relation` |
| `GraphEdge.type.value` | `data.relation` | meaningless without `family`, which is why both ship |
| `GraphEdge.type.vocabulary` | `data.vocabulary` | present only for `inference_step_relations` |
| `GraphEdge.sourceTable` | `data.sourceTable` | which vocabulary the word came from |
| `GraphEdge.traversal` | `data.traversal` | a walk rule; never becomes `target` |
| `GraphEdge.attributes` | `data.projectionAttributes` | `role`, `ordinal`, `description`, … |
| — | element `classes` | presentation only: `type-*`, `status-*`, `is-focus`, `family-*`, `relation-*`, `traversal-*` |

`classification` is conditionally spread so the key is genuinely absent on non-cards rather than present-and-`undefined`, which Cytoscape would drop from `data()` and make indistinguishable from a card missing its classification.

## Presentation contract

`toCytoscapePresentation(projection)` returns `{ elements, context }`. `elements` goes straight to `cytoscape({ elements })`. `context` carries `focus`, `view`, `depth` and `meta`, because Cytoscape has **no graph-level attribute bag** the way Graphology does — without it a renderer could not distinguish a capped graph from a small one, nor surface the warnings that separate an unpopulated layer from a broken request.

**Semantic identity vs presentation metadata** is enforced by *which field a value lands in*: everything in `data` is asserted on; `classes` is disposable and carries no meaning. `classes` sits at element level because Cytoscape ignores a `classes` key placed inside `data`.

No `cytoscape.Core` is instantiated — the conversion is pure, so it needs no `container` and no `headless`, and one conversion can feed many cores. The domain contract stays authoritative; the tests build real headless cores anyway to prove the library accepts the output.

## Findings that shaped the design

I probed the library rather than assuming. Cytoscape's **silent** id handling turned out to be the load-bearing constraint:

| input | Cytoscape 3.34.3 |
|---|---|
| two nodes sharing an id | merged into one node, no error |
| two edges sharing an id | merged into one edge, no error |
| node id equal to an edge id | **the edge is discarded entirely** |
| edge → absent endpoint | throws |
| `classes` inside `data` | ignored |
| input definitions / nested objects | not mutated |

Graphology rejects duplicates loudly, so `graphology-adapter.ts` gets those guards nearly free. Here a projection bug that reused an id would render a quietly smaller graph with nothing failing. All three are refused with `CytoscapeAdapterError` rather than disambiguated. Also verified: parallel edges between one pair both survive, and `false`/`null` survive a round trip while `undefined` is dropped.

## The type-qualified id question — left open, as instructed

**Not solved, and deliberately so.** It does not need solving for a clean adapter: node ids are `trope_graph` uuids and `buildEdgeId` always emits `family|from|TYPE|to[|discriminator]`, so a uuid cannot contain the `|` delimiter and the two id spaces cannot collide. That invariant is **pinned by a test**, not left to a comment.

Recorded as graph-contract hardening item **`as-truth-cards-2bq`**, cross-referenced from the adapter, the test and both docs: if a type-qualified scheme is ever adopted, or a real collision is ever observed, resolve it at the contract layer (`types.ts` + `projection.ts` + both adapters + tests) — never by prefixing or deduplicating ids inside a presentation layer.

## Semantics preserved — verified, not asserted

- Directed edges stay directed; `traversal` remains a walk rule carried as data. A bidirectional edge is still one directed Cytoscape edge.
- `family` and `relation` stay separate fields, so `claim_relation: SUPPORTS` can never be confused with `card_relationship: SUPPORTS`. Also pinned: a family/type contradiction is **rejected**, since that is precisely the flattening the design forbids.
- `HAS_CONCEPT` stays distinct from `HAS_MECHANISM` — separate relations, separate edges, separate `sourceTable` (`card_concepts` vs `card_mechanisms`), and separate classes.
- `domain:ASSERTS`, `inference:PREMISE_OF`, `inference:CONCLUDES` and `claim_relation:SUPPORTS` all remain distinct. The authored-but-unsupported conclusion stays an inference edge; it is never rendered as a claim-to-claim edge.
- Only `card_relationship` edges join two cards, asserted over the whole edge set.
- Axis/Locale/Collection metadata survives, including the primary-axis ordinal (not a rolled-up flag), the Suit/Locale id-and-slug pairing, and a Suit and Locale that share a slug in separate fields. Verified through a real core, since `false` and `null` are facts and `undefined` is an absence.
- Status stays per node type (`epistemic_status` / `independent_inference_status` / `none`) — nothing is rolled up.
- Both `card-argument-taxonomy` and `taxonomy` are consumed; neither view name appears in the adapter.
- Empty and sparse projections convert cleanly; repeated conversion is byte-identical; nodes always precede edges.

**No ontology semantics changed.** No schema, migrations, new Claims/Concepts/Sources/Evidence/Cases/Interpretations/Questions, no Axis/Locale/Collection semantic change, no Concept or claim-relation inference, no geopolitical hierarchy, no `public.cards`/Prisma revival, no Graphology change, no deployment or auth work, no UI, no editor or write-back path.

## Test counts and how far they can be trusted

- **292 graph tests pass** (was 237, **+55**), 0 fail · server 19/19
- `typecheck:graph` clean · root `typecheck` clean · `build` green · `check-drift`: `drift: false`, 402 facts
- `lint`: 17 errors / 5 warnings — **unchanged baseline**, all in untouched `src/components/`

One caveat on the LSP view of the test file: editors report type errors in
`trope-cards/test/cytoscape-adapter.test.ts` that `tsc` does not. The two disagree because
Biome's `files.includes` covers `trope-cards/src/**/*.ts` but **not** `trope-cards/test/**/*.ts` —
so all 15 test files sit outside the formatter. `tsc -p trope-cards/tsconfig.json` exits 0 with zero
diagnostics on every file, test included; that is the authoritative check. Worth widening Biome's
include list in a separate commit, since it would restyle the other 14 test files.

**Mutation-tested.** I broke the adapter 27 ways — dropped `family`, swapped direction, moved `classes` into `data`, removed each id guard, hardcoded `HAS_MECHANISM`, substituted status, reversed element order, shared the array instance across calls, and more. Every one is caught by a named test.

One survivor was a **real gap**, not a bad mutation: nothing asserted that node `metadata` survived. That is now pinned field by field, including the card-only `legacyPrimaryTypeIsAxis: false`, and through a real core.

Two other apparent survivors were quoting bugs in my harness rather than coverage holes, and I re-ran them properly to confirm.

I also corrected two fixtures that would have made tests pass vacuously: the shared corpus defaults to `depth: 2`, because at `DEFAULT_DEPTH` (1) the projection emits no inference edges at all, so every reasoning assertion was passing against a graph containing no reasoning; and the Axis test builds a projection by hand, because `FakeCorpus` has no `card_axes` and the existing axis assertion was comparing `[]` to `[]`. A vocabulary test was likewise vacuous until I gave it a `stepRelations` row at `depth: 3`.

## Adapter limitations

1. **No layout, stylesheet, or interaction** — elements only, no CSS. That is the non-goals boundary; the UI is §10 steps 6–8.
2. **`classes` are conventions, not a stylesheet.** A view must supply its own CSS; the adapter guarantees only that the hooks exist.
3. **Id collisions are refused, not resolved.** If the graph contract changes to type-qualified ids and a real collision appears, this adapter throws and the decision goes back to Issue #3.
4. **A node's `type` is not validated against its `metadata` shape.** `types.ts` already discriminates the union on `type`; re-checking each metadata bag here would duplicate the contract where it is most likely to drift. Unknown *types* are rejected; malformed metadata for a known type is caught by the type system, not at runtime.
5. **`relationship` is not validated against `family`.** The projection resolves `relationships` endpoints defensively and reports disagreement in `meta.warnings` (Q5); the adapter copies the authored value and adds no opinion.
6. **No live-DB integration suite, deliberately.** The risk here is Cytoscape's behaviour, not the seeded corpus's — so the suite uses a real headless core instead. The five existing integration suites still skip without `TROPE_GRAPH_DATABASE_URL` (they add 51 more when one is set).

## Follow-up filed

`as-truth-cards-2bq` — decide whether `GraphNode.id` should be type-qualified. Priority P2, open, unblocked.

**Issue #3 remains open.** §10 steps 6–8 (Cytoscape UI, entity views, richer projections) are untouched, as is the outstanding id question.

---

*(Committed `4ac66d9`; `main` pushed to GitHub and the Codeberg mirror, both at `4ac66d9`.)*