# Bucket B interaction proposal — Compose / Decompose

**Status:** proposal only. **Not authorized for implementation.** Returned for maintainer review per gh#16 comment `7126649881`.

This proposal covers Q1 (authoring/read-panel hierarchy), Q3 (step and chain disclosure), Q5 (save bar and validation feedback), Q6 (mobile disclosure), and the three step presets added in `03957ca`. It is presentation and interaction design only: no change to the S1 draft contract, canonical ontology/data, schema, migrations, API, validation rules, or external integrations.

## 1. Decision summary

| Area | Recommended option | One-line decision |
|---|---|---|
| Q1 hierarchy | **B — role-distinguished surfaces, read panel summarized** | Keep DOM order; frame the draft workspace distinctly; collapse the populated read panel when signed in, keep zero-claim and signed-out panels open. |
| Q3 disclosure | **B — controlled per-card disclosure** | Collapsed summary for existing step/chain cards; newly added card auto-opens; independent expansion; issue counts and “go to” links on the summary. |
| Q5 save feedback | **A — sticky under site header + focused issue banner** | Save state stays reachable; pristine empty is neutral; blockers are amber, not errors; failure is an assertive alert. |
| Q6 mobile | **Adaptive, not blanket collapse** | Keep authoring entry points and question headings visible; collapse only individual cards; no all-sections-collapsed default. |
| Presets | **Keep as-is, with one doc annotation** | Labels/grouping/focus are accurate; do not add a fourth preset or change the model. |

Official/platform primitives are the first choice throughout: native `<details>/<summary>`, native `<button aria-expanded aria-controls>`, CSS `position: sticky`, `scroll-margin-top`, and existing Tailwind tokens. No new library, service, credential or MCP dependency is required.

---

## 2. Integrated layout proposal

### 2.1 Desktop — populated card, signed in, long draft

```text
┌─ PageShell / PageMain ──────────────────────────────────────────────────────┐
│ Breadcrumb: Research / Compose                                             │
│ Compose — Study a card's recorded reasoning, then author your own draft.   │
│                                                                            │
│ ┌─ Choose a card ────────────────────────────────────────────────────────┐  │
│ │ Card  [anc-hamas-equivalence            ▾]   [Back to research]       │  │
│ │ Author a decomposition of one card. The recorded reasoning is shown   │  │
│ │ for study, kept separate, and never edited here.                      │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Recorded reasoning ─ READ ONLY · CORPUS ──────── [Read recorded ▸] ───┐  │
│ │ 3 claims · 2 steps · 1 chain                                            │  │
│ │ (collapsed: only the summary row above is visible)                      │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Your decomposition draft ─ NOT CANONICAL ─────────────────────────────┐  │
│ │ ╔═ sticky under site header ═════════════════════════════════════════╗ │  │
│ │ ║ Unsaved changes     2 issues to fix before saving [Review issues] ║ │  │
│ │ ║ [Save draft (off)] [Discard changes] [Delete saved draft]          ║ │  │
│ │ ╚═══════════════════════════════════════════════════════════════════╝ │  │
│ │ A draft for you, on this card only. It can never become canonical.     │  │
│ │                                                                        │  │
│ │ What is the assertion?  formal term: working claim  [Example]          │  │
│ │ [Add working assertion]                                                │  │
│ │                                                                        │  │
│ │ What reasons are offered?  formal term: premises  [Example]            │  │
│ │ How does the reasoning work?  formal term: inference step  [Example]   │  │
│ │ What challenges or qualifies it?  formal term: counterpremise / ...    │  │
│ │ A premise may be marked COUNTERPREMISE ... A challenge is optional.    │  │
│ │ [Add step] [Add inference step] [Add challenge]                        │  │
│ │                                                                        │  │
│ │ ┌ Step: Simplified explanation │ CAUSAL │ 2 premises · 1 conclusion  │  │
│ │ │ WORKING · Used in 1 chain │ 1 issue ▸                    [Remove]  │  │
│ │ └────────────────────────────────────────────────────────────────────┘  │  │
│ │ ┌ Step: Challenge │ UNSPECIFIED │ 1 premise · 0 conclusions           │  │
│ │ │ Status not set │ 2 issues ▸                               [Remove]  │  │
│ │ │ (expanded only because it was just added)                           │  │
│ │ └────────────────────────────────────────────────────────────────────┘  │  │
│ │                                                                        │  │
│ │ Construct an argument  formal term: argument chain  [Example]          │  │
│ │ [Add chain]                                                            │  │
│ │ ┌ Chain: Simplification-to-speed │ PRIMARY_ARGUMENT │ 2 steps          │  │
│ │ │ MAIN: Inference step │ WORKING ▸                           [Remove]  │  │
│ │ └────────────────────────────────────────────────────────────────────┘  │  │
│ │                                                                        │  │
│ │ The draft is not saveable yet.                                         │  │
│ │  • The step needs at least one conclusion claim. [Go to step]          │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

Key hierarchy decisions:

- The read panel is a quiet reference surface (`bg-graph-muted/30`, text badge `READ ONLY · CORPUS`).
- The draft workspace is the active surface (`bg-background`, stronger border, visible `NOT CANONICAL` badge). It owns the save bar.
- DOM order is unchanged: **choose card → read summary → draft workspace**. No CSS reordering.
- `ListSection` headings become `h3` under a single `h2` “Recorded reasoning”; editor questions remain `h3` under `h2` “Your decomposition draft”. This removes the current `h1 → h4` jump in the read panel.
- The summary counts are text, not colour alone: `3 claims · 2 steps · 1 chain` (singular-aware).

### 2.2 Desktop — zero-claim card

The recorded panel is **static and open**, with the existing three honest empty notes visible:

```text
┌─ Recorded reasoning ─ READ ONLY · CORPUS ─────────────────────────────────┐
│ 0 claims · 0 steps · 0 chains                                             │
│ Claims on this card                                                       │
│   Canonical claims are not currently recorded for this card. You can      │
│   begin with a working assertion below; it stays in your draft.           │
│ Reasoning steps recorded for this card                                    │
│   No reasoning steps are currently recorded for this card.                │
│ Argument chains                                                           │
│   No argument chains are currently recorded for this card. You can        │
│   construct your own below; it stays in your draft.                       │
└───────────────────────────────────────────────────────────────────────────┘
```

No disclosure toggle appears when there is no recorded content. The draft workspace below is identical to 2.1 minus cards.

### 2.3 Desktop — empty draft, pristine

Save bar status is `No draft saved yet.` with all actions disabled. There is **no** amber issue banner even though `draftIssues(EMPTY_DRAFT)` is non-empty. The only guidance is the three neutral invitations:

- `Start with an assertion. It stays in your draft.`
- `Add a step to connect reasons to a conclusion.`
- `Add a reasoning step first, then construct a chain.`

### 2.4 375px mobile — populated card, signed in, long draft

```text
[fixed site header ~77px]
Breadcrumb · Research / Compose
Compose
[Choose a card — stacked select + helper]

┌ Recorded reasoning — READ ONLY · CORPUS ─────────────┐
│ 3 claims · 2 steps · 1 chain      [Read recorded ▸]  │
└──────────────────────────────────────────────────────┘

┌ Your decomposition draft — NOT CANONICAL ────────────┐
│ ╔ sticky ≤104px ════════════════════════════════════╗ │
│ ║ Unsaved changes                                   ║ │
│ ║ 2 issues to fix before saving                     ║ │
│ ║ [Review issues]                                   ║ │
│ ║ [Save draft] [Discard changes]                    ║ │
│ ║ [Delete saved draft]                              ║ │
│ ╚═══════════════════════════════════════════════════╝ │
│ What is the assertion?  formal term: working claim    │
│   [Example]                                           │
│ [Add working assertion]                               │
│ What reasons are offered?  formal term: premises      │
│   [Example]                                           │
│ [Add step] [Add inference step]                       │
│ [Add challenge]                                       │
│ ┌ Step: Simplified explanation │ CAUSAL              │
│ │ 2 premises · 1 conclusion │ 1 issue ▸   [Remove]   │
│ └────────────────────────────────────────────────────┘
│ ┌ Step: Challenge │ UNSPECIFIED │ 0 conclusions      │
│ │ 2 issues ▸                          [Remove]       │
│ │ (auto-expanded because just added)                 │
│ └────────────────────────────────────────────────────┘
│ Construct an argument  formal term: argument chain    │
│ [Add chain]                                           │
│ The draft is not saveable yet.                        │
│  • The step needs at least one conclusion claim.      │
│    [Go to step]                                       │
└───────────────────────────────────────────────────────┘
```

Mobile defaults differ from desktop only in what is collapsed:

| Surface | Desktop | 375px |
|---|---|---|
| Recorded panel, populated, signed in | collapsed with counts | collapsed with counts |
| Recorded panel, zero-claim or signed out | open | open |
| Question sections (assertion / steps / chains) | open | open — never all collapsed |
| Existing step/chain cards | collapsed summary | collapsed summary |
| Newly added card | auto-open | auto-open |
| Save bar | sticky, one row | sticky, compact row(s), ≤104px |
| Issue banner | visible when dirty + blocked | visible when dirty + blocked; “go to” links wrap |

The preset row wraps 2+1 at 375px (`Add step` + `Add inference step`, then `Add challenge`). That is acceptable and already present in the shipped UI; no horizontal clipping.

---

## 3. Interaction and state tables

### 3.1 Recorded-panel disclosure

| Condition | State | Summary content | Content visibility |
|---|---|---|---|
| Signed in, populated (`claims+steps+chains > 0`) | Collapsed by default | `Recorded reasoning`, `READ ONLY · CORPUS`, counts, `Read recorded` | Hidden; one activation reveals the three subsections |
| Signed out, populated | Open by default | Same, cue becomes `Hide recorded reasoning` | Visible; it is the only substantive content on this route |
| Zero-claim card | Static, no toggle | `0 claims · 0 steps · 0 chains` | Existing empty notes always visible |

Expansion is local view state and resets on card change via the existing `key={activeSlug}` remount. It is never persisted in the draft.

### 3.2 Step/chain card disclosure

| Event | Result |
|---|---|
| Existing card on load | Collapsed summary: title, type badge, counts, status, relationship hint, issue count, `Remove`. |
| New card added | Auto-expanded; focus moves to the preset's target (step: label / inference type / premise select; chain: Label). |
| Toggle activated | Expands/collapses that card only; other cards unaffected (no accordion). Focus stays on the toggle. |
| Collapse while focus is inside body | Focus moves to the toggle before hiding. |
| Remove activated from summary | Card removed; focus moves to next card's toggle, or the section's Add button if none. Announce cascade (e.g. `Removed step X; also removed 2 chains that used it`). |
| `Go to step` / `Go to chain` from banner or relationship hint | Target expands, focus moves to its first invalid control (label → epistemic status → first premise/conclusion select), and `scrollIntoView({ block: 'nearest' })` applies scroll margins. |
| Issue appears on a collapsed card | Summary shows `N issue(s)` text and `aria-describedby` link to the banner item. The card is **not** force-expanded. |
| Reorder requested | Out of scope: the model has no reorder API and ordinals are internally reassigned. Proposed only as a separate pure-model change before any UI control. |

Summary counts are deliberately visible when zero (`0 premises · 0 conclusions`) because those are the first save blockers.

### 3.3 Save state model

Derived only from existing inputs (`auth`, `dirty`, `canSave`, `issueCount`, `hasDraft`, `savedAt`, `saving`, `savingError`).

| State | Status line | Secondary line | Buttons |
|---|---|---|---|
| Pristine empty | `No draft saved yet.` | none | Save off, Discard off, Delete off |
| Pristine saved | `Saved at HH:MM` | none when clean | Save off, Discard off, Delete on |
| Dirty clean | `Unsaved changes` | `Ready to save.` | Save on, Discard on, Delete per `hasDraft` |
| Dirty blocked | `Unsaved changes` | `{n} issue{s} to fix before saving` + `Review {n} issues` | Save off, Discard on, Delete per `hasDraft` |
| Saving | `Saving…` | none | all disabled; Save reads `Saving…` |
| Saved after write | `Saved at HH:MM` | none | Save off, Discard off, Delete on |
| Save failure | `Unsaved changes` | `{savingError}` in red, `role="alert"` | Save on (retry), Discard on, Delete per `hasDraft` |
| Pristine saved with issues | `Saved at HH:MM` | `This saved draft has {n} issue{s} to fix before it can be saved again.` (amber, not red) | Save off, Discard off, Delete on |
| Signed out | `Sign in to save your own decomposition.` | none | no buttons; bar not sticky |

Server-validation copy stays verbatim: `The draft has N problem(s) to fix.`, `Some claims are not on this card.`, `Request failed with HTTP {status} while trying to {action}`.

### 3.4 Validation feedback timing

| Moment | Feedback |
|---|---|
| Pristine empty | No amber banner anywhere. Only neutral invitations. |
| First edit that leaves issues | Sticky bar shows `Unsaved changes` + count + `Review {n} issues`. Amber/muted, not `role="alert"`. Banner list not auto-expanded. |
| Activation of `Review {n} issues` | Focus moves to the existing `compose-issues` banner (`tabIndex={-1}`), which remains the single source of exact `ComposeIssue.message` text. Bullets gain `Go to step` / `Go to chain` controls. |
| More edits, still blocked | Count updates once per state transition; no repeated alert. |
| Save failure | Separate assertive alert with server message; no focus theft; Save remains actionable for retry. |
| Save success | Polite `Draft saved at HH:MM.`; focus/caret unchanged. |

The banner renders only when `dirty && issues.length > 0` (or on failure for server-returned issues). This keeps the existing `data-testid="compose-issues"` while preventing the empty draft from looking broken.

---

## 4. Keyboard and screen-reader considerations

- Keep DOM order identical to visual order: picker → read summary/content → save bar/sign-in → editor. No CSS `order` or grid placement that diverges.
- Use native `<details>/<summary>` for the recorded panel. A single `h2` inside the summary gives a navigable heading; Enter/Space works and expanded state is announced. Keep a visible focus ring.
- Use a real `<button type="button">` with `aria-expanded` and `aria-controls` for each step/chain card. Remove stays a sibling, never nested inside the disclosure control.
- Name card toggles `Step {label or 'Unlabelled step'}` / `Chain {label or 'Unlabelled chain'}`. Do not duplicate state in the name; `aria-expanded` conveys it.
- After any Add: auto-expand, then move focus to the relevant control. Steps retain the existing `focusAddedStep()` behaviour; chains get the equivalent focusing their Label.
- After programmatic expand from an issue or relationship link: move focus to the first invalid control, falling back to the toggle. After keyboard toggle: leave focus on the toggle. After collapse with focus inside: move focus to the toggle first.
- Save status + blocker count live in one `role="status" aria-live="polite"` region, updated once per state transition (short debounce while typing). `savingError` gets a separate `role="alert"`. Never put the full issue list in a live region.
- `Save draft` uses `aria-describedby` pointing to the blocker id when blocked and the error id on failure. Prefer `aria-disabled` with a no-op handler for “nothing to save” and blocked states so focus is not destroyed; native `disabled` only while saving.
- No state is signalled by colour alone: read-only, not-canonical, zero counts and issue counts are text. Red remains an additional cue for destructive/failed states.
- Add `scroll-margin-top` to the recorded panel, each editor section, each card, and the issue banner so focus/scroll never lands under the fixed header plus sticky save bar. At 375px this needs a larger margin than desktop.

---

## 5. Review of shipped screenshots and the three presets

Refreshed screenshots in `docs/compose/screenshots/` were reviewed against `docs/COMPOSE_DESIGN_HANDOFF.md`.

**Result: no material mismatch.** Specifically:

- Save bar copy (`No draft saved yet.`, `Saved at HH:MM`, `Unsaved changes`), button labels and disabled states match the handoff.
- Formal terms and all five collapsed/expanded `Example` disclosures match.
- The guidance under “What challenges or qualifies it?” matches the handoff verbatim.
- `01` shows the signed-out gate; `02` shows all five examples expanded; `04` shows a developed saved draft with `Inference step`, `Challenge` and a chain; `05` shows `Not yet canonical` and `Raw is_canonical flag`; `06` is clean at 375px with no horizontal clipping. A previously observed header ghost in `05` was a capture-while-scrolled artifact; the current file was retaken from the top and rechecked — no duplicate header remains.
- Presets: all three are grouped with equal weight. The handoff states they create the same `DraftStep` shape via `addStep` with different starting labels/focus. The guidance explicitly says `Add challenge seeds a labelled step; the role is still yours to choose` and `A challenge is optional in a draft`. Screenshot `04` shows a `Challenge` step with `UNSPECIFIED` and a user-selected `COUNTERPREMISE` role. Nothing implies an automatic COUNTER role, a complete challenge, or a mandatory challenge.

Minor documentation annotations worth adding when the change is implemented (not contradictions, and not done in this design-only phase):

1. The handoff says the presets are “grouped as one row”; add that they wrap 2+1 at 375px.
2. The red text on `Delete saved draft` is visible in screenshots but undocumented.
3. `Back to research` / `returnTo` behaviour is code-and-test documented but not visible in any screenshot.

No fourth preset and no data-model change is proposed.

---

## 6. Options considered and attack checks

### Q1 options

- **A — Frame editor + fix headings, leave read panel open.** Low effort, lowest risk; does not fix the long populated page.
- **B — Recommended: A + summarized native disclosure for populated panel, static zero-claim/signed-out panel.** Moderate effort; mitigates “recorded material skipped” with counts, cue text, signed-out exception and unchanged DOM order.
- **C — Two-column desktop read/editor.** High effort and overlaps Q6; changes focus and reading order. Rejected.

### Q3 options

- **A — Native `<details>/<summary>` inside CardFrame.** Native semantics, but Remove cannot be a child of `<summary>`; controlled auto-open and issue jumps still need imperative control.
- **B — Recommended: controlled toggle button + hidden body + local `Set` of expanded keys.** Slightly more code than A, but driveable from Add, issue links and relationship links, with no nested-interactive hazard.
- **C — Accordion, one card open.** Cheapest state model, but blocks cross-card comparison and can hide issues. Rejected.

### Q5 options

- **A — Recommended: sticky top bar under header + focused issue banner.** Save state always reachable; costs ~80–104px of viewport chrome.
- **B — Non-sticky bar + miniature status pill on scroll-out.** Less occlusion, but duplicate controls/live regions and ambiguous focus. Rejected.
- **C — Non-sticky only with copy/banner fixes.** Cheapest, but Q5’s core complaint remains. Rejected.
- Bottom-fixed action bars are rejected: they cover the last field at 375px and collide with the on-screen keyboard.

### Q6 approach

No separate “collapse every section” option is recommended. The existing authoring sequence is the entry point; collapsing whole sections would hide discoverable actions and the formal-term/example disclosures. Collapse only the long repetition (existing cards), keep summaries and headings visible, and keep save state visible.

### Attack checks on the recommendation

| Angle | Finding and deformation |
|---|---|
| Dependency failure | No external services, keys or new packages. The sticky offset depends on header height; use a shared layout token rather than a magic `top-20`, and verify at both breakpoints. If the token drifts, the bar can overlap or gap — acceptance includes a visual check after any header change. |
| Scale explosion | Long drafts remain scrollable, but collapsed summaries keep repeated field grids out of view. A large issue list is capped with `max-h-[40vh] overflow-y-auto` in the sticky region and accessed via `Review {n} issues`; counts are derived from existing arrays. Relationship links are O(n) per card and acceptable at expected draft sizes. |
| Rollback cost | Every change is view state or presentation. Expansion state is not persisted, so reverting requires no data migration; reverting the commits plus screenshots/docs restores the shipped UI. |
| Premise collapse | The fragile assumption is that hiding populated recorded material by default is acceptable. Deformed accordingly: signed-out and zero-claim panels are always open; populated signed-in panel always shows counts and an explicit `Read recorded` cue; card expansion is never persisted; maintainer can veto this single decision without disturbing Q3/Q5/Q6. |

---

## 7. Staged implementation plan (not started)

### Stage 0 — maintainer decision (gate)
Confirm this proposal, especially the Q1 collapsed-populated default and the Stage 1 grouping below. No files change in this stage.

### Stage 1 — hierarchy + save feedback (ship together)
**Why together:** Q1 moves the save bar into the draft workspace and Q5 makes it sticky; both depend on the same DOM order, sticky offset token and scroll margins. Shipping separately would require two rounds of screenshot/test churn.

Scope:

- `src/pages/Compose.tsx`: wrap surfaces with `h2`s; keep testids `compose-editor-region`, `compose-picker-select`, `canonical-decomposition`; insert shared sticky offset token usage.
- `src/compose/canonical-read.tsx`: native disclosure summary with counts/cue for populated; static panel for zero-claim; signed-out exception via prop from workspace; demote `ListSection` to `h3`.
- `src/compose/compose-editor.tsx`: draft workspace heading/badge; SaveBar sticky wrapper, opaque background, compact mobile rows; state model and copy from §3.3–3.4; banner gating and `tabIndex={-1}`; `aria-live`/`aria-describedby`; omit banner when pristine empty.
- Tests: `canonical-read.test.tsx`, `compose-editor.test.tsx`, and a new small render-order test for `Compose.tsx` (no dedicated page test exists today).
- Docs/screenshots: handoff §2–5, §7–9; recapture `01`, `02`, `05`, `06`.

Acceptance criteria:

- DOM order picker → read → draft remains; heading levels contain no `h1 → h4` jump.
- Populated signed-in card: panel collapsed with accurate counts; signed-out and zero-claim panels open.
- Save bar stays visible while scrolling a long draft at 1440px and 375px; it never covers the focused field (scroll margins verified).
- Pristine empty draft shows no amber issue banner; dirty blocked draft shows count + `Review {n} issues`; failure shows the exact server message with `role="alert"`; success does not move focus.
- Existing save contract and `canSaveDraft` behavior unchanged; all current save-gate tests pass with updated copy assertions only.

**Independent testability:** Q1 panel disclosure and Q5 save states can be asserted in separate component suites before screenshots are recaptured.

### Stage 2 — step/chain disclosure (independent after Stage 1)
Scope:

- `src/compose/compose-editor.tsx`: `CardFrame` disclosure props; `expandedKeys` local view state; summary rows for steps and chains; `data-chain-key`; chain focus helper; issue-count and relationship links; focus management from §3.2.
- Tests: expansion does not mark draft dirty; Add auto-expands and focuses; collapse-with-focus-inside returns focus; issue and relationship jumps expand and focus the right card; remove focus fallback/cascade announcement.
- Docs/screenshots: handoff §5–7 and §8; recapture `03`, `04`, `05`.

Acceptance criteria:

- Existing cards start collapsed; newly added step or chain starts expanded with focus in the documented control.
- Multiple cards can be open; no accordion behavior.
- Remove is always reachable from the summary and never nested inside the disclosure control.
- Collapsed cards with errors show `N issue(s)`; banner bullets offer working `Go to` links; no card is force-expanded by validation.
- No change to `DraftPayload`, `draftIssues`, ordinals, save diff or server validation.

**Independent testability:** entirely component-level; no model or API tests change.

### Stage 3 — mobile verification and populated-draft overflow (can ship with Stage 1 or 2, tested separately)
Scope:

- Apply the 375px refinements from §2.4/§3.4.
- Resolve the already-filed `as-truth-cards-z6q`: expanded step rows with long labels currently reach `bodyScrollWidth: 768` at a 375px viewport. Collapsed summaries reduce exposure but do not fix expanded rows; acceptance requires a real fix for the expanded state.
- Recapture `06` with both zero-claim and a populated draft.

Acceptance criteria:

- `bodyScrollWidth <= innerWidth` at 375px for empty, zero-claim, and populated/long drafts, with at least one expanded step and one expanded chain.
- All authoring entry points, formal terms, save status and issue links remain visible/discoverable.
- Preset row may wrap 2+1; nothing clips or overlaps.

### Stage 4 — handoff reconciliation and review (part of each stage, final gate)
Update handoff with the minor annotations from §5, refresh all affected screenshots, run focused tests + typecheck + lint + browser/vision QA, then return for maintainer review before merging. S2 (advisory challenge UX), S3 (derived argument paths) and S4 (Figma convergence) remain separately gated and are not touched by any stage.

---

## 8. Design summary for approval

- **Building (if approved):** a role-distinguished Compose workspace with a summarized read-only panel, collapsible step/chain summaries, a sticky save/status bar with honest state and blocker feedback, and explicit mobile defaults that preserve authoring entry points.
- **Not building:** Bucket B code/CSS/component changes in this phase; S2/S3/S4; fourth preset; reorder controls; persistence of expansion state; autosave; any change to validity rules, draft contract, canonical data, schema, migrations or API.
- **Approach:** native disclosure primitives plus controlled card toggles and a sticky status bar, using existing tokens and no new dependencies. Q1 and Q5 ship together; Q3 follows independently; Q6 is verified at each stage.
- **Key decisions:** populated read panel collapsed when signed in but open when signed out or zero-claim; existing cards collapsed but new cards auto-open; independent (not accordion) expansion; pristine empty is neutral; blockers are amber, failures are red alerts; mobile never collapses whole authoring sections.
- **Unknowns (explicitly deferred, with owner):** none blocking. Reorder needs a separate model proposal before any UI (owner: maintainer decision). The Q1 collapsed-default is the one assumption the maintainer may veto without disturbing the rest.
