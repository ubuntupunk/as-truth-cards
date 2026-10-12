# Issue 12 — Research/Publication Tracking + Optional PlumX Integration

- **Date:** 2026-10-12
- **Scope:** Research report, a sent Elsevier eligibility inquiry, and the provider-neutral
  schema foundation (migration `0012_research_sources.sql`). **PlumX integration remains
  gated**: no PlumX widget and no PlumX/Elsevier API call is enabled. No discovery adapter,
  no metrics provider, and no UI component ship with this report.
- **Grounding:** PlumX widget mechanics verified against the shipped widget bundle
  (`//cdn.plu.mx/widget-all.js`), the production OJS Plum plugin (ulsdevteam/ojs-plum-plugin
  templates), and PlumX docs. Screenshots in `docs/PlumX/` could **not** be reviewed by the
  reporting assistant (no image input support) and are flagged for human confirmation.

## 1. Current-state audit

**There is no canonical "publication" entity.** The canonical bibliographic/provenance
record is `sources` (trope_graph), which this work extends rather than replaces.

- `sources` (`trope-cards/src/db/schema/tropeGraph.ts`): `id`, `title`, `author`,
  `publisher`, `publicationDate`, `sourceType` (enum: PRIMARY_DOCUMENT, JUDGMENT, PLEADING,
  LEGISLATION, INSTITUTIONAL, ACADEMIC, BOOK, JOURNALISM, ARCHIVE, OTHER), `url`,
  `archiveUrl`, `citation`, `description`. Identifiers historically existed only as free
  text inside `citation`/`url`.
- `claim_sources`: attribution record (claimId, sourceId, free-text `relationship`,
  quoteOrExcerpt, pageReference, notes). Attribution-only, per the settled B5/lpp decision —
  never "support".
- Evidence layer (`trope-cards/src/db/schema/evidenceLayer.ts`): `evidence_items` (type,
  locator/locatorType, status), `evidence_sources` (`DERIVED_FROM`), `evidence_claims`
  relation vocabulary `SUPPORTS / CHALLENGES / QUALIFIES / CONTEXTUALISES / ILLUSTRATES /
  REPORTS / ATTRIBUTES`. This is the support chain; it must stay distinct from attribution
  and from metrics.
- `relationships` polymorphic edges: enum covers SUPPORTS, CHALLENGES, CONTEXTUALISES,
  RELATED, CONTRADICTS, etc. **Lemma gap:** the issue's semantics "documents the
  existence/circulation of a claim" and "discusses / relevant to" have no dedicated enum
  member today. This is deliberately left open (see §3.2).
- Frontend: `SourceSummary` (`src/graph/projection-guards.ts`); `src/sources/source-index-panel.tsx`
  renders title/type badge, metadata lines (Author/Publisher/Citation via `source-model.ts`),
  a URL link, and an attribution count. No identifiers surfaced, no metrics.
- `research_events` already logs `SOURCE_OPENED` etc. — telemetry, not impact metrics.
- SPEC §8 holds Source ≠ Evidence; ROADMAP Milestone 6 (Sources & provenance) is the home
  for this work.

## 2. PlumX widget mechanics (verified)

**Script** (load once, before `</body>` or deferred):

```html
<script type="text/javascript" src="//cdn.plu.mx/widget-all.js"></script>
```

(`//cdn.plu.mx/widget-popup.js` is a subset script covering only the print-popup class.)

**Widget** — the script upgrades an empty anchor in place by fetching
`api.plu.mx/widget/{site}` and rendering the five-category donut:

```html
<a href="https://plu.mx/plum/a/?doi=10.1371/journal.pone.0197326"
   class="plumx-plum-print-popup"
   data-size="lg" data-hide-when-empty="true" data-popup="left"></a>
```

**Identifiers.** The `href` query parameter is the artifact identifier PlumX resolves:
`doi`, `pmid`, `pmcid`, `pii`, `isbn`, `eissn`/`issn`, `upc`, `url`, `ssrn`, `poster`,
`isro`. Confirmed live forms: `https://plu.mx/plum/a/?doi=10.1371/journal.pone.0197326` and
`?pmid=29772003`.

**Attributes** (read from the anchor's `data-*`, camelCased in the widget options):

| Group | Attributes |
|---|---|
| Presentation | `data-size` (`xs`→`xl`), `data-orientation` (`horizontal`/`vertical`), `data-badge`, `data-width` |
| Popup | `data-popup` (`left`/`right`/`hidden`), `data-border`, `data-no-link`, `data-detail-same-page` |
| Visibility | `data-hide-when-empty` (default true), `data-hide-print` |
| Category toggles | `data-hide-citations`, `data-hide-captures`, `data-hide-socialmedia`, `data-hide-mentions`, `data-hide-usage` |
| Data | `data-exclude-scopus-citations`, `data-num-artifacts`, `data-no-stats`, `data-site`, `data-lang` |

Other upgraded widget classes: `plumx-plum-summary`, `plumx-plum-category`,
`plumx-plum-counts`, `plumx-plum-details`, `plumx-plum-fivecategory`, `plumx-plum-person`,
`plumx-plum-group`.

**Open verification flags:**

- The docs page is a JS SPA; its copy also mentions a `<plumx-widget>` custom element. A
  distinct custom-element script could **not** be located on `cdn.plu.mx` (`widget.js`,
  `widget-embed.js`, `plumx.js` → 404), and `widget-all.js` wires the anchor classes.
- `cdn.plu.mx/widgets/v1` + `api.plu.mx/widget/…` are **API** endpoints the widget script
  calls. Do not assume PlumX Metrics **API** access is included with widget rights.

## 3. Approach

### 3.1 Schema foundation (SHIPPED — migration 0012)

Provider-neutral storage, useful with open data and independent of the PlumX gate:

- **`sources` provenance columns** — `metadata_provider`, `metadata_retrieved_at`,
  `metadata_verified_at`, `access_status`, `correction_status` (all nullable; the authored
  corpus predates any retrieval and is not forced to invent one).
- **`source_identifiers`** — persistent identifiers as a child table, not a column per
  scheme, because the set of schemes is open-ended (DOI, PMID, PMCID, arXiv, ISBN, ISSN,
  SSRN, Scopus, …). `unique (scheme, normalized_value)` is the invariant: one identifier
  resolves to exactly one source. `scheme` is open `text` for the same reason.
- **`discovery_candidates`** — a human review queue, not a second source table.
  `unique (provider, provider_record_id)` makes ingest idempotent; `provenance` (provider,
  endpoint, request) is NOT NULL; `promoted_source_id` is the only, explicit, human-set path
  to a canonical source. The table has no foreign key to `claims` or `interpretations`.
- **`source_metrics`** — attention/use observations, each with `provider`, `metric_key`,
  `metric_value`, `observed_at`, optional `window_start`/`window_end`, a **required**
  `definition`, optional `limitations`, `source_url`, and `retrieved_at`. Re-importing one
  day's snapshot updates rather than duplicates (`unique (source_id, provider, metric_key,
  observed_at)`).

It reuses the existing model rather than replacing it: `sources` is still the canonical
record, `claim_sources` is still attribution-only, and none of the new tables is an edge in
the support chain.

### 3.2 Publication→claim semantics (OPEN — deliberately not decided here)

Support ⇒ `evidence_claims` relation vocabulary; attribution/provenance ⇒ `claim_sources`.
The two issue gaps — "documents the existence/circulation of a claim" and "discusses /
relevant to" — are **not** added to the `relationship_type` enum in this change. Adding
ontology members is a semantics decision that must first check the semantic contracts and
explain why `claim_sources` / `evidence_claims` cannot represent the relation; inventing
members now would change the ontology without that argument. Tracked as follow-up on #12.

### 3.3 Open metadata discovery (PROPOSED — no adapter shipped)

Evaluate then implement modest adapters for **Crossref** and **DataCite** first, add
**OpenAlex** where its terms and rate limits suit, and consider **OpenCitations** for
citation relationships. Every adapter:

- respects the provider's terms, rate limits, attribution, and licence;
- sends a contact address in requests;
- records provider provenance, the query, and retrieval time on every candidate;
- reconciles duplicates by persistent identifier (never by title alone);
- performs **no paid dependency** and no scraping of third-party social metrics.

Discovery yields **candidates only**. Nothing becomes a curated source or evidence without
human review, and a discovery match is never treated as support.

### 3.4 Metrics model (PROPOSED — definitions)

Our own transparent, first-party metrics — not a PlumX clone, and never labelled "PlumX".
Candidate definitions to store (each with source, definition, observation window,
last-updated, coverage/limitations):

- `citation_count` — the number of works that cite the source, from a **named open
  citation index** (e.g. OpenCitations). Limitations: coverage is uneven across disciplines,
  languages, and publication types; includes self-citations unless a variant excludes them;
  not comparable across fields.
- `source_opened_count` (optional) — first-party aggregate of `research_events`
  `SOURCE_OPENED` for a source. **Only if privacy/consent permits**, aggregated only, never
  per-user.

Every metric is recorded attention/use. Popularity is not quality and never truth; the
original publication link is always kept.

### 3.5 Component + provider boundary (PROPOSED)

Our own reusable Research Metrics component backed by our data and a `MetricProvider`
interface. It renders a graceful "no data" state. The PlumX adapter is **isolated and
disabled** behind the authorization gate (§4); enabling it is a one-provider change, not a
rewrite.

### 3.6 Federation (PROPOSED — design only)

Future-compatible goal, not implemented. The identifier/provenance/metrics tables are
designed so canonical sources, their identifiers, and their observation provenance are
portable: a future federation would exchange those records with provenance rather than
scraping another instance. No exchange format or endpoint is defined yet.

## 4. Authorization gate + sent inquiry

**Release gate (unchanged):** no PlumX widget and no PlumX/Elsevier API integration may be
enabled until written authorization and applicable terms are confirmed and logged here. Do
not claim permission was granted.

**Status:** the eligibility inquiry has been **sent** and is **awaiting a response**. The
text below is retained as the record of what was asked.

> To: Elsevier / Plum Analytics support
>
> Subject: Eligibility inquiry — PlumX widget for a non-commercial research and educational site
>
> I am writing on behalf of Trope Deck (working name), a non-commercial, self-directed
> research and education site that presents structured informational cards and a
> claim-ontology graph about antisemitic tropes, alongside their scholarly sources. We would
> like to know whether we may use the PlumX metrics widget to display attention/usage
> metrics for cited research publications.
>
> Specifically, we ask:
> 1. Is this site and intended use eligible for the PlumX widget under your current terms?
>    Does any subject-matter restriction apply?
> 2. The site is non-commercial today. Voluntary subscriptions or community contributions
>    may eventually help cover operating costs, but the funding model is not yet defined.
>    Would any form of cost-recovery subscription or contribution affect eligibility?
> 3. Which widget types and features are permitted, and what restrictions apply to how
>    metrics are displayed, linked, cached, or retained?
> 4. Does the widget or any related script/API set cookies or collect data from site
>    visitors, and what privacy/consent obligations apply?
> 5. Is access to the PlumX Metrics API (versus the embeddable widget) included, or does it
>    carry separate subscription/access requirements?
>
> We will not enable the widget or API until we receive written confirmation of eligibility
> and the applicable terms. Thank you.

## 5. Provider/data licences and privacy (to confirm per provider)

| Provider | Intended use | Licence posture (confirm before ingest) |
|---|---|---|
| Crossref | Works metadata (discovery) | Bibliographic metadata made openly available; check current terms/attribution. |
| DataCite | Works metadata (discovery) | Metadata CC0 in practice; confirm current terms. |
| OpenAlex | Works metadata + links | Data CC0 with an acknowledgement/citation request and rate limits; confirm. |
| OpenCitations | Citation links (metrics) | Indexes released under CC0; confirm current terms. |
| PlumX / Elsevier | Widget + optional API | Gated; nothing enabled until §4 is answered in writing. |

Privacy: first-party `research_events` are user-scoped; any metric derived from them must be
aggregate-only and must not expose per-user activity. No third-party trackers are added. The
PlumX widget's cookie/consent behaviour is an explicit question in §4 and a hard gate.

## 6. Deliverables status (#12)

1. Architecture note — this report.
2. Schema/types/tests — **SHIPPED**: `0012_research_sources.sql`,
   `src/db/schema/researchSources.ts`, provenance columns on `sources` in
   `src/db/schema/tropeGraph.ts`, and `test/schema-research-sources.test.ts`. Discovery
   adapters, the metrics provider, and the component are **not** shipped.
3. Eligibility inquiry — **SENT**, awaiting response (§4).
4. Release gate — documented in §4 and ROADMAP M6.
5. ROADMAP/authoritative-doc updates — `ROADMAP.md` M6 updated. SPEC §8 wording proposed,
   not yet edited.
6. Reporting — this file + the issue #12 comment.

### Checks run

- `typecheck:graph` — pass
- `typecheck:all` — pass
- `biome check` — pass
- `trope-graph:check` — pass: `migrate:check`, validators, `verify`, **488 tests pass**,
  `check-drift` reports `drift: false` over 467 compared facts.

## 7. Blockers / open decisions

- The 4 screenshots in `docs/PlumX/` were not readable by the reporting model (no image
  support) — human confirmation needed for any screenshot-specific layout or attribute.
- `<plumx-widget>` custom-element script URL unconfirmed on CDN.
- Elsevier eligibility and API access unknown until the inquiry returns.
- Open: relationship vocabulary for "documents existence/circulation" and
  "discusses/relevant to" (§3.2); which open metadata providers to implement first and in
  what order; whether first-party `source_opened_count` is admissible under the privacy
  policy; SPEC §8 release-gate wording.
