# Issue #9 — Figma divergence design note (maintainer decision pending)

**Status:** decision request, not a defect report and not design sign-off. Issue #9 stays
open; 0/11 acceptance criteria are release-verified. No production code was changed to
produce this note.

**Purpose:** make the recorded Deck and Card differences specific enough for a maintainer
to choose **align**, **adapt**, or **accept** for each. Per `ROADMAP.md`, a visual
difference is not automatically a defect.

## Evidence and provenance

| Evidence | Path / node | Date | Use |
|---|---|---|---|
| Figma Deck frame | `docs/issue-9/screenshots/figma/current-2026-11-23/deck-7-4434.png`, node `7:4434` | 2026-11-23 | Current Figma reference |
| Figma Card frame | `docs/issue-9/screenshots/figma/current-2026-11-23/card-7-4617.png`, node `7:4617` | 2026-11-23 | Current Figma reference |
| Local Deck desktop/mobile | `docs/issue-9/screenshots/current-2026-11-23/decks-1024px.png`, `decks-375px.png` | 2026-11-23 | Current app baseline |
| Local card faces | `docs/issue-9/screenshots/decks-1024px-front.png`, `decks-1024px-flip-claim.png`, `decks-1024px-flip-analysis.png` | 2026-10-12 | **Stale for styling/state**; predates `pt-24` page-shell fix and the #13/#14 slices. Used only for structural comparison, corroborated by current source. |
| Source of truth for current behaviour | `src/pages/Deck.tsx`, `src/deck/featured-card.tsx`, `src/deck/card-reading.tsx`, `src/deck/card-save-button.tsx`, `src/lib/page-layout.ts` | current | Current interaction/state |

The 2026-11-23 375px capture was re-checked at full size: the heading, descriptive text,
disclaimer and filter pills are vertically separated — **no heading/pill overlap**. The
overlap seen in the October screenshots is resolved by `PAGE_MAIN_CLASS` (`pt-24`) and
is not an open defect.

## Already resolved

**Card count (`1 / 8` in Figma vs `47 cards` in the app): accept as illustrative.** The
Figma number is placeholder content, not a design contract. The live graph count is
authoritative; no code or Figma change is requested.

---

## 1. Deck surface

### What Figma draws

- Dark, near-black "Discover" page. Fixed top bar with "TROPE DECK" wordmark, nav
  (Decks / Explorer / Compose / Graph / Research / Sources), workspace and avatar.
- Three columns: left rail **Your decks** (named decks, Saved cards, New deck), centre
  single-card viewer, right rail **In your research tray** with three card entries and
  an "Open research workspace" action.
- Header copy "A new way into the question."; pill chips `8 CARDS`, `All axes`,
  `Open questions`; status chip `OPEN • UNVERIFIED`; pagination `1 / 8` with
  Previous / Shuffle next; actions Read front & back, Read analysis, Save card.
- Amber/orange accents, dense card chrome, compact typography.

### What the local app does now

- Light, off-white themed index page using the shared `PageShell` and `PAGE_MAIN_CLASS`
  (`src/lib/page-layout.ts`), with global header/nav and an Appearance control
  (`src/deck/deck-appearance-control.tsx`).
- Single centred column; no left or right rails. Breadcrumb + "Decks" heading +
  description + research disclaimer, then functional filters over live data:
  `47 cards`, `Without repeats`, axis / research-status / locale pills
  (`src/pages/Deck.tsx`, `src/deck/card-discovery.tsx`).
- One featured card per page with `1 / 47`, Previous / Shuffle next
  (`src/deck/card-navigation.tsx`) and actions Read front & back, Read analysis,
  Explore in graph, Save card (`src/deck/card-actions.tsx`).
- `Save card` is auth-aware: signed out it is disabled with a visible reason; signed in
  it checks and toggles the account saved-cards API
  (`src/deck/card-save-button.tsx`). The October screenshot showing a permanently
  disabled button is stale.

### Where we actually diverge

| # | Dimension | Classification | Why it matters |
|---|---|---|---|
| D1 | Navigation model: Figma single-card viewer with two rails vs local filtered grid index with no rails | **Structural** | Adding rails changes page layout, nav semantics and responsive behaviour; removing filters would remove working functionality. |
| D2 | Rail content: "Your decks" and "In your research tray" | **Structural / content** | Both imply persisted deck and tray concepts. The app has a research session (`src/research/research-session.ts`) but no named-deck list. Building the rails as real features is more than CSS. |
| D3 | Card count / pagination (8 vs 47) | Resolved — illustrative | No action. |
| D4 | Default theme: Figma dark vs local light with an Appearance control | Cosmetic / product decision | The app already supports appearance switching; choosing dark as default is a product call, not new behaviour. |
| D5 | Accent (amber vs purple/black), density, chip shape, typography | Cosmetic | Theme-level tokens; low implementation risk. |
| D6 | Filter pills: functional in local, absent in Figma | Functional difference | Figma does not model the app's filtering; aligning by removing filters would regress accepted local behaviour. |
| D7 | Save affordance: Figma active "Add to workspace" vs local auth-gated "Save card" | Functional / policy | The local gate is intentional and tested; change only with a product decision about anonymous saving. |

### Options for the maintainer

- **A — Align to Figma.** Rebuild the Deck as a three-column dark Discover view with
  real left/right rails, wire the rails to deck/tray data, keep live card data and
  filters (or explicitly drop them), and make dark the default. Highest cost; touches
  `src/pages/Deck.tsx`, `src/deck/*`, theming and responsive tests. Would need new
  decisions on what "Your decks" and the tray actually persist.
- **B — Adapt hybrid (smallest credible convergence).** Keep the working filter/index
  and card navigation; add Figma's visual language (dark-capable tokens, denser card
  chrome, right-hand research-tray summary) without inventing named decks or removing
  filters. Cosmetic/theming work plus one additive rail; existing navigation tests stay
  valid. Left rail remains explicitly out of scope.
- **C — Accept local as-is.** Record the current Deck as the accepted design and note
  that the Figma frame is exploratory. No code change; Figma sign-off would refer to
  the accepted local direction rather than the frame.

**Decision needed:** choose A / B / C, and separately state whether dark or light is the
default appearance. If A or B, say whether the rails must be backed by persisted data
or may be illustrative in this release.

---

## 2. Card detail surface

### What Figma draws

- Dark, single long page headed "Read the claim. Inspect the basis." with Saved /
  Add to workspace actions.
- Three simultaneously visible panels: **FRONT / WORKING CLAIM**, **BACK / INQUIRY &
  LIMITS** (Ask / Test / Limit rows, "NO VERIFIED EVIDENCE ATTACHED"), and an
  **ANALYSIS** panel with a narrative-analysis empty state.
- Right sidebar with Classification table (Entity Card / ID-01, axes, mechanism,
  concept, period, locale, collection), a Research path chain
  `Claim → Source / Evidence → Inference → Argument chain`, a draft inference
  `/F-01 UNVERIFIED`, and "Inspect in Graph".
- Actions at the bottom: Back to claim, Back to front, Explore in graph, Save card.

### What the local app does now

- `FeaturedCard` (`src/deck/featured-card.tsx`) is a two-face flip: front (Cover) and
  back, where the back shows one of three stage labels — Cover / Claim / Analysis.
  Controls move between faces; the inactive face is `inert` and `aria-hidden`, and a
  live region announces "Current face". This is the implementation audited in #14.
- `CardReadingPanel` / `CardAnalysis` (`src/deck/card-reading.tsx`) render the Analysis
  face: authored narrative (when present), provenance & reasoning counts, evidence,
  claims / reasoning steps / sources lists, and counter-evidence limitations with
  honest empty states.
- Classification is rendered inline as chips on the card rather than in a sidebar;
  Explore in graph and the auth-aware Save card action live in `src/deck/card-actions.tsx`.

### Where we actually diverge

| # | Dimension | Classification | Why it matters |
|---|---|---|---|
| C1 | Simultaneous three-panel page vs stateful two-face flip | **Structural** | Aligning changes routing/stage state, `inert`/`aria-hidden` handling, flip animation and the #14 tests that verify three-face navigation. |
| C2 | Right sidebar metadata: classification table, Research path chain, draft inference | **Content / structural** | The chain and draft-inference display have no local equivalent; classification exists only as inline chips. This is missing information, not just placement. |
| C3 | Back-face fields Ask / Test / Limit and "no verified evidence" banner | Content | Local Analysis face has provenance/evidence empty states but not the same inquiry-field structure. |
| C4 | Narrative analysis empty state | Aligned in substance | Both show an honest "no narrative analysis supplied" message; wording/placement differs. |
| C5 | Dark dense styling vs light/spacious local styling | Cosmetic | Same theme decision as D4/D5. |
| C6 | Active "Add to workspace" vs auth-gated Save card | Functional / policy | Same policy question as D7. |
| C7 | Card titles/IDs (Figma ID-01 "Israelite identity…" vs live card data) | Resolved — illustrative | Placeholder content; live canonical data is authoritative. |

### Options for the maintainer

- **A — Align to Figma.** Replace the flip with a three-panel detail page and add the
  metadata sidebar, including Research path and draft-inference panels. Requires a
  product decision on where draft-inference data comes from and a rewrite of the #14
  face-navigation and reduced-motion tests.
- **B — Adapt hybrid.** Keep the verified flip and three faces; add a compact detail
  rail that surfaces classification as a table and the Research path chain using data
  already in the projection, without changing face state or keyboard behaviour. Add
  Ask/Test/Limit-style labels only if the ontology has real fields for them — do not
  invent content.
- **C — Accept local as-is.** Treat the two-face flip as the accepted detail
  interaction and record the Figma three-panel layout as exploratory. No code change.

**Decision needed:** choose A / B / C. If B, confirm that the Research path chain should
be derived from existing projection data only, and decide whether the missing
Ask/Test/Limit fields are real ontology fields or illustrative copy.

---

## 3. Maintenance of this note

This note records options only. Once a maintainer chooses, record the decision in
`docs/ISSUE_9_ACCEPTANCE_DISPOSITIONS.md` disposition 3 and Issue #9, and implement only
the chosen option with its tests. Until then, do not treat either surface as
Figma-accepted, and do not close Issue #9.
