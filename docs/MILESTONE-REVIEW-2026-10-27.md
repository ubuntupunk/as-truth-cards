# Milestone Review — 2026-10-27

## Purpose and evidence standard

This report reconciles the project roadmap with the GitHub workstreams as of 27 October 2026. It is a planning assessment, not a claim that every route or gate was independently executed during this review. A feature described as implemented is not automatically accepted; acceptance requires reproducible tests and/or documented manual verification.

**Recent implementation context supplied during this review:** the latest agent round concerned avatar settings. The preceding round added Narrative Analysis to the card's third face. These are recent implementation steps and must be audited and verified before anyone proposes reimplementing them. This review's earlier concerns about missing narrative content should therefore be treated as a verification/integration question, not as an assumption that the feature is still absent.

## Executive assessment

| Workstream | Current assessment | Next action |
|---|---|---|
| Canonical ontology / graph architecture | Foundation established; remaining contract decisions are bounded | Preserve the architecture; verify outstanding graph contract and environment gates |
| Graph Explorer | Core implementation reported delivered; full acceptance remains | Complete interaction, responsive, keyboard and accessibility acceptance |
| Deck / three-face card | Core exists; recent Narrative Analysis implementation needs verification | Test Cover → Claim → Analysis navigation, narrative rendering, empty state and accessibility; do not reimplement blindly |
| Product shell / navigation | Integration acceptance remains open | Verify the actual cross-surface journey at supported viewports |
| Explore / discovery | Acceptance outstanding; shared discovery contract is tracked separately | Coordinate with Issue #8; avoid duplicative page-specific search |
| Compose / Decompose | Partial foundation; complete workflow remains outstanding | Verify draft persistence and the boundary between user-authored analysis and canonical ontology |
| Research Workspace | Partial foundation; workflow integration remains outstanding | Preserve graph/card/source context and distinguish research, auth and durable activity state |
| Sources / provenance | Backend foundation substantial; review and metrics UI remain outstanding | Prioritise human discovery-review UI and Research Metrics UI before adding more providers |
| Account / onboarding | Real journey and improved account panels reported implemented; other account capabilities remain | Verify recent avatar settings work and reconcile remaining Settings/activity/account-persistence gaps |
| Security / authorization | Issue #10 policy decisions and Issue #11 server-side actor handling have implementation evidence; production assumptions still require explicit verification | Do not redo completed code without evidence; record remaining deploy/runtime checks |
| Release readiness | Not established as complete | Run current gates, record results and classify blockers precisely |

## Milestone assessment

### M1 — Canonical ontology and graph foundation
**Assessment: established foundation.** The project separates canonical graph semantics in `trope_graph`, server-side projections, presentation components, and account/participation state in `public`. Keep remaining graph-contract work small and separate from product-surface implementation. Do not reopen the graph foundation for unrelated UI work.

### M2 — Graph Explorer
**Assessment: core implementation reported delivered; acceptance remains.** The documented work includes read-only graph APIs, multiple views, URL-driven focus/view/depth, inspection, provenance/evidence states and facet filtering. Acceptance still needs repeatable interaction, responsive, keyboard and accessibility evidence.

### M3 — Deck and three-face card
**Assessment: verify the latest implementation before deciding further work.** The user reports that Narrative Analysis was added to the third face in the round immediately before the avatar-settings round. Verify that it is backed by the intended data contract, appears on the Analysis face, has an honest empty/unavailable state, and is reachable through clear keyboard-operable navigation. The three faces are presentation states of one canonical card, not separate ontology entities. Do not reimplement the narrative feature solely because an earlier review described it as missing.

### M4 — Global navigation / product shell
**Assessment: integration acceptance remains open (Issue #9).** Route existence is not sufficient. Verify that users can find and operate Decks, Explore, Graph, Compose, Research and Sources on desktop and mobile; that drawers have correct focus/dismissal behaviour; and that cross-surface links preserve appropriate context.

### M5 — Explore / Browse
**Assessment: acceptance outstanding.** Use canonical content and coordinate search behaviour with Issue #8. Verify discovery, supported filters/sorting, transitions to card/graph/research, and honest loading, empty, error and unavailable states.

### M6 — Compose / Decompose
**Assessment: partial foundation.** Complete an end-to-end workflow and verify persistence and permission boundaries. Drafts, inferences and user-authored analysis must not silently become canonical ontology records.

### M7 — Research Workspace
**Assessment: partial foundation.** Integrate graph focus, card/source context, filters, analytical state and notes as specified. Keep research session state, authentication session state and durable account activity distinct. Signing in must not silently transfer anonymous history into account activity.

### M8 — Sources and provenance
**Assessment: substantial backend foundation; product workflow incomplete (Issue #12).** The roadmap reports source identifiers/provenance, discovery candidates, Crossref and DataCite adapters, review/promotion APIs, concurrency handling and DML-protected append-only event history. Outstanding items include discovery-review UI, Research Metrics UI, provider pagination, OpenAlex terms review, and unresolved raw-payload retention. OpenCitations was assessed as unsuitable for the existing keyword-search port. Keep PlumX gated on written authorization and applicable terms. Prioritise researcher-facing review UI before expanding provider scope. Discovery/popularity/citation metrics are not evidence by themselves.

### M9 — Accounts and participation
**Assessment: onboarding journey and improved account/profile panels reported implemented; milestone remains open.** Issue #13 contains implementation and test evidence for a multi-step journey, profile editing, verification resend and appearance selection. Appearance and participation preferences have been labelled device-local where no account persistence contract exists. The latest agent round was specifically about avatar settings: inspect the latest changes and determine whether avatar selection is display-only, device-local, or server-persisted; ensure UI copy matches actual behaviour and no unsupported account fields are invented. Remaining work includes end-to-end account-required actions, Save card integration, My Activity/Settings parity, email-change management and other follow-ups identified in Issue #13. Do not repeat completed onboarding work without a failing acceptance criterion.

### M10 — Security, privacy and operational readiness
**Assessment: decisions and implementation evidence exist; release-level verification remains.** Issue #10 records an explicit CORS allow-list, one-hop trusted-proxy configuration and security tests; Issue #11 records server-side actor derivation and authorization policy. Preserve these findings and do not redo them without evidence of a regression. Confirm remaining deployment assumptions (including proxy headers) and keep database/event immutability claims scoped accurately: the current shared owner/runtime role means trigger enforcement is DML-scoped, not a privilege boundary against that owner role.

### M11 — Full verification and release readiness
**Assessment: not yet accepted.** Run the repository's current documented checks, including `pnpm run trope-graph:check`, `pnpm test`, `pnpm run test:ui`, `pnpm run typecheck`, `pnpm run build`, and established lint/format checks. Respect the known restriction against running DB-touching checks against the shared remote Neon host without explicit authorization. Distinguish environmental blockers, pre-existing baseline failures and regressions. Do not report the whole release as green when a required gate is blocked.

## Recommended priority order

1. **Reconcile and verify the two most recent changes first:** avatar settings, then Narrative Analysis on the third face. Inspect current code and tests before proposing changes; avoid duplicate implementation.
2. **Complete the integrated card-reading path:** Cover → Claim → Analysis, clear navigation, narrative content/empty states, accessible controls, and links into related graph/research context.
3. **Finish account-required actions and remaining account surfaces:** Save card and return-context handling, then the outstanding My Activity/Settings/account persistence items. Keep device-local and server-persisted settings explicit.
4. **Close security and authorization acceptance gaps:** confirm current implementation and deployment assumptions without redoing already verified fixes.
5. **Complete shared product-shell and discovery workflows:** coordinate Issue #9 with Issue #8; verify navigation and responsive behaviour.
6. **Build the researcher-facing source review and metrics UI:** prioritise usability of the existing source-discovery backend over adding providers.
7. **Run and document the full acceptance suite:** update ROADMAP.md only with evidence-backed statuses.

## Definition of the next meaningful milestone

Demonstrate one integrated, research-ready vertical slice:
- A reader discovers and opens a canonical card.
- Cover, Claim and Analysis are discoverable and keyboard-operable.
- Narrative Analysis renders correctly when present, with honest empty/unavailable states when not.
- The reader can follow relevant links into graph/research/source context.
- Account-required actions preserve intended context without weakening server-side authorization.
- Relevant automated tests and manual browser checks are recorded.

This does not require every provider or every research surface to be finished. It requires the implemented parts of the slice to work together and respect the ontology, evidence and identity boundaries.

## Repository references

- [ROADMAP.md](../ROADMAP.md)
- [SPEC.md](../SPEC.md)
- [Issue #7 — post-graph research surfaces](https://github.com/ubuntupunk/as-truth-cards/issues/7)
- [Issue #8 — broader card discovery](https://github.com/ubuntupunk/as-truth-cards/issues/8)
- [Issue #9 — product shell](https://github.com/ubuntupunk/as-truth-cards/issues/9)
- [Issue #10 — security review](https://github.com/ubuntupunk/as-truth-cards/issues/10)
- [Issue #11 — participation authorization](https://github.com/ubuntupunk/as-truth-cards/issues/11)
- [Issue #12 — research publication tracking](https://github.com/ubuntupunk/as-truth-cards/issues/12)
- [Issue #13 — onboarding and account panels](https://github.com/ubuntupunk/as-truth-cards/issues/13)
- [Issue #14 — narrative analysis and three-face navigation](https://github.com/ubuntupunk/as-truth-cards/issues/14)
