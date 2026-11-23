# Milestone Review — 2026-11-23

## Purpose and evidence standard

This review reconciles the current `ROADMAP.md`, repository implementation notes, and GitHub issues/comments as of 23 November 2026. It is a coordination and status assessment, not a fresh execution of the full test suite or a live production audit.

**Status vocabulary:** implemented means code is reported present; verified means repeatable tests or documented manual checks support the behaviour; accepted means the roadmap acceptance criteria have been reviewed and signed off. These are separate states.

Primary tracking:
- [Issue #9 — remaining product shell and acceptance](https://github.com/ubuntupunk/as-truth-cards/issues/9)
- [Issue #12 — source discovery and metrics foundation](https://github.com/ubuntupunk/as-truth-cards/issues/12)
- [Issue #13 — onboarding and account panels](https://github.com/ubuntupunk/as-truth-cards/issues/13)
- [Issue #14 — narrative analysis and three-face reading](https://github.com/ubuntupunk/as-truth-cards/issues/14)
- [Issue #15 — feedback and academic-participation delivery](https://github.com/ubuntupunk/as-truth-cards/issues/15)

## Executive assessment

The project has moved materially beyond the 12 October roadmap snapshot. The canonical ontology/graph architecture, source-discovery backend, application shell, and much of the account experience are implemented. The principal remaining risk is integration and acceptance of the end-to-end research product—not a need to redesign the foundations.

| Workstream | Current assessment | Evidence / tracking | Next action |
|---|---|---|---|
| Canonical ontology and graph | Foundation established; preserve existing boundaries | `trope_graph`, read-side graph projections, roadmap invariants | Re-run graph integrity gate when correct DB environment is available |
| Graph Explorer | Core implementation exists | Existing graph stack and Issue #7 successor backlog | Finish interaction, route, responsive and accessibility acceptance |
| Deck / card reading | Core implementation exists; narrative feature reported landed | Issue #14 comment records `editorial_notes` read path and UI | Acceptance audit only; do not duplicate implementation |
| Global shell/navigation | Substantial implementation and browser harness reported | Issue #9, commits and E2E report | Complete remaining acceptance and record evidence |
| Explore / Browse | Surface acceptance outstanding | Roadmap Milestone 3; Issue #9 | Complete canonical search/browse workflow |
| Compose / Decompose | Partial foundation; end-to-end workflow not accepted | Roadmap Milestone 4; Issue #9 | Implement bounded draft workflow and persistence contract |
| Research Workspace | Partial foundation; end-to-end workflow not accepted | Roadmap Milestone 5; Issue #9 | Integrate graph/card/source/composition context |
| Sources | Backend foundation substantially implemented; UI gaps remain | Issue #12; roadmap Milestone 6 | Review UI, metrics UI, pagination and provider decisions |
| Account/onboarding | Many account surfaces reported implemented and tested | Issue #13 latest implementation reports | Verify remaining account gates and persistence boundaries |
| Feedback / academic participation | Product definition and delivery capability outstanding | New Issue #15 | Resolve consent, recipient, event, sender and withdrawal design |
| Security / operations | Issue #10 review closed; release gates still not all verified | Issue #9 E2E report and latest comments | Separate credential-history decision; run release checks |
| Release readiness | Not established | Roadmap Milestone 9 | Complete full integrated verification and deployed checks |

## What has materially landed

### 1. Source discovery and provenance backend

The roadmap records the following as implemented and verified:
- Provider-neutral source identifiers, discovery candidates, metrics and provenance metadata.
- Crossref and DataCite adapters and a shared polite HTTP transport.
- Discovery API with allow-listed providers, clamped limits and deduplication.
- Human-reviewed candidate promotion, with no automatic promotion to evidence.
- Revision-token concurrency control for competing review/promotion decisions.
- Append-only review-event history and non-owner runtime-role privilege-boundary tests.

The architecture correctly preserves the rule that discovery, citation, popularity or a source record is not itself evidence. The support chain remains through the canonical claim/source/evidence relationships.

Still outstanding: provider pagination; discovery-review UI; Research Metrics UI; OpenAlex pending terms/rate-limit review; OpenCitations as a metrics/citation-links provider rather than a keyword-search adapter; and raw-payload retention pending privacy/licensing decisions. PlumX/Elsevier must remain optional and must not become a dependency absent written authorization.

### 2. Account and onboarding

Issue #13 reports implementation and tests for:
- Multi-step onboarding and server-confirmed profile persistence.
- Improved profile panels and account navigation.
- Email verification and resend states.
- Saved cards.
- Activity panel.
- Sign-in and account dropdown.
- Verification-first email change.
- Account-persisted avatars.

The avatar audit reports bytes stored in `UserAvatar`, with a versioned public URL in `User.image`; device-local preferences remain separate, and initials are the fallback. This is the intended distinction between server-persisted account data and local presentation state. Do not reimplement the avatar path without identifying a reproducible defect.

Remaining account work includes auditing account-required actions and Save Card gating/return context, verifying avatar persistence and retrieval across sessions/devices, and reconciling account-side preferences only when the corresponding product capability exists.

### 3. Narrative Analysis

Issue #14's later audit reports the narrative feature already implemented using `trope_graph.cards.editorial_notes`, exposed through read-only graph projections and rendered on the Analysis face. The card reading UI leads with narrative content while preserving claims, reasoning, sources, evidence and limitations as distinct structures.

Treat #14 as a verification and gap-fixing task, not a greenfield implementation. Verify long-form rendering, absent/unavailable states, Cover → Claim → Analysis navigation, keyboard/focus handling, narrow/desktop layouts, reduced-motion and no-3D fallback, and links. Close only with repeatable evidence.

### 4. Product shell

Issue #9 remains open. Its latest E2E report distinguishes locally verified feature paths from items that are not release-verified. Reported local results include UI/server tests and build/typecheck checks, but the same report explicitly leaves graph integrity, deployed Render checks, Figma reconciliation, and a specific in-card malformed-state browser case unverified or blocked.

Do not translate local success into production acceptance. Preserve the browser, viewport, input, environment and commit details for every acceptance claim.

## Important security decision — public Git history

The latest Issue #9 discussion records that commit `28e8775` exposed test-account email/password text and an ADMIN-escalation statement in public history on GitHub and Codeberg. The password has reportedly been rotated and the test account disabled. The exposed text remains reachable in history.

The agent prepared a history-cleanup plan covering a fresh mirror clone, `git filter-repo`, both remotes, downstream clone coordination, and GitHub cached views/support. The latest maintainer direction correctly labels this **pending maintainer approval**.

**No history rewrite or force-push is authorized by this review.** The agent must not execute the plan, relax branch protection, or rewrite either remote. First provide a concise decision package: exact affected refs/remotes, verified secret-scan findings (redacted; never repeat the secret), downstream consumers/forks/branches, recovery/rollback plan, force-push sequence, cache/support steps, and post-rewrite verification. Maintainer approval is required before execution.

Issue #10 is closed as a separate CORS/trusted-proxy review; that closure does not resolve this public-history incident or establish overall release readiness.

## Recommended execution sequence

### P0 — Maintainer decision package
- Agent prepares the history-cleanup decision package only.
- Maintainer explicitly approves, rejects, or defers the rewrite.
- No destructive Git operation before approval.

### P1 — Reconcile and accept existing implementation
- Issue #9: report exact current state of every shell criterion, separating implemented, locally verified, manually verified, blocked and release-verified.
- Issue #14: complete the card narrative/three-face acceptance audit; fix only demonstrated gaps.
- Issue #13: audit avatar persistence/retrieval, Save Card gate and safe return context; do not redo shipped onboarding/profile work.

### P1/P2 — Complete the core research workflow
- Explore/Browse: canonical data-driven discovery, documented search/filter semantics, route/context preservation and honest states.
- Compose/Decompose: user-authored drafts kept outside canonical ontology; explicit persistence and permission rules.
- Research Workspace: coherent graph/card/source/composition context; research state distinct from auth session and durable participation.
- Sources: discovery review UI and metrics UI; pagination and additional providers only after their respective terms/fit decisions.

### P2 — Participation product decision
Issue #15 must define the actual feedback-email and academic-participation capabilities before account-side consent is persisted. Specify event sources, recipients, frequency, consent version/timestamp, withdrawal/unsubscribe/suppression, retention, sender and failure handling. Do not collect consent for a nonexistent service.

### P3 — Integrated release acceptance
Run the repository's required graph check, test suite, UI tests, typecheck, build and lint; record command, commit, environment and pass/fail/blocked result. Verify deployed Render behaviour separately. Complete responsive, keyboard/accessibility and Figma reconciliation. Do not call a blocked gate passed.

## Roadmap disposition

This review does not close Issues #9, #12, #13, #14 or #15 and does not declare any milestone accepted. The roadmap must continue to distinguish implementation from verification and release acceptance. The next update should be evidence-led and should not turn reported work into an accepted milestone without tests/manual evidence.

## Agent protocol for this review

1. Read `SPEC.md`, `ROADMAP.md`, this report and the relevant issue threads before acting.
2. Audit current `main`; do not assume comments or older milestone reports describe current code exactly.
3. Do not duplicate already-landed narrative, avatar, onboarding, source API or account-panel work.
4. Work in small vertical slices with tests and explicit acceptance evidence.
5. Preserve canonical semantic boundaries: `trope_graph` is ontology authority; account identity/participation remains in `public`; discovery candidates are not sources/evidence; user drafts are not canonical facts; research session is not authentication session.
6. Never run destructive operations against shared Neon or rewrite public Git history without explicit maintainer approval.
7. Update the relevant issue and `ROADMAP.md` with commit, test commands/results, environment, limitations and remaining work. Do not mark a gate or milestone accepted merely because implementation exists.
