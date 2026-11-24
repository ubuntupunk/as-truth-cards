# Mobile Compose authoring proposal — focused editing with a compact save bar

**Status:** revision 1, proposal only. **Not authorized for implementation.** A1 was approved in principle in gh#16 comment `7134292493`; this revision resolves the interaction and accessibility details that comment required and is returned for review. No implementation has begun.

This is presentation and interaction design only. It proposes a narrowly scoped, separately gated "Stage 1.5" refinement. It does **not** change the draft contract, validation semantics, save API, database schema, migrations, canonical graph or data, and it does not begin Stage 2/Q3 or S2/S3/S4. Issue #16 stays open as the umbrella.

## 1. Decision summary

| Question | Decision / recommendation | One-line decision |
|---|---|---|
| Mobile save bar | **A1, approved in principle** | One sticky bar, one status live region, one authoritative issue banner; on ≤640px a single row (≤48px) with status + one contextual action + one real `More save actions` button. |
| Focus-aware slim mode | **A1 preferred; A2 fallback** | While an editor control has focus, the bar keeps the same three slots at a ≤44px visual height; A2 (compact-only) remains the fallback if focus-aware behaviour proves unreliable or inaccessible. |
| Secondary actions | **Real button, not an ambiguous surface** | `More save actions` is a `<button type="button">` with an accessible name, `aria-expanded` and `aria-controls`; its revealed region is in-flow below the bar. The native `<details>` idea is retained only as a fallback implementation of the same one-button pattern. |
| Touch targets | **44×44px minimum** | The 32px slim target from revision 0 is revised to 44px: interactive hit areas must not be compromised to win vertical space. |
| Scroll geometry | **~152px starting point** | Reduce mobile `scroll-margin-top` from 228px and tune in-browser; desktop stays 168px. |
| Input discovery | **Mobile-only semantic button** | `Start authoring` is a `<button type="button">` that focuses the first editor control; it is not navigation. |
| Full validation list | **Unchanged** | `#compose-issues` stays the single authoritative banner with complete issue text; the bar only summarizes counts. |

Official/platform primitives remain the first choice: native buttons with accurate ARIA state, CSS `position: sticky`, `scroll-margin-top`, and existing Tailwind/token patterns. No new library, service, credential or MCP dependency is required.

---

## 2. Problem evidence

Measured in the signed-in 375px layout after Stage 1 (header bottom 95px; mobile sticky top 104px; mobile `scroll-margin-top` 228px):

| State | Sticky bar height | Top of viewport consumed before authoring |
|---|---|---|
| Clean / saved | 85px | ~180px |
| Dirty blocked or saved-but-now-invalid | 99px | ~194px |
| Exact server failure alert | 104px | ~199px |

At a 375×420 keyboard-like viewport, focusing the first editor control leaves it at **307–341px**: 118px of dead space between the bar bottom (189px) and the field, only **79px below the field**, and **1 of 18** editor controls fully visible below the bar. A real on-screen keyboard reduces the usable viewport further.

The bar's height is only half the problem. The 228px scroll margin reserves room for the *tallest* bar even when the compact state is showing, so shrinking the bar alone would not move fields up. Both numbers must change together.

The maintainer reports that the mobile keyboard itself works. That is welcome, but `as-truth-cards-fb0` remains open until real-device or suitable-emulator evidence with the OS keyboard raised is recorded against it; this revision does not close that follow-up.

---

## 3. Goals and non-goals

**Goals**

- Give the focused editor control and its neighbours usable vertical space at 375px with the keyboard raised.
- Keep save state reachable and blockers distinguishable from real save failures (the accepted Q5 contract).
- Keep one bar, one status live region, one alert, and one authoritative issue banner — no duplicate controls or announcements.
- Keep every interactive target comfortably operable by touch, including in slim mode.
- Preserve the accepted read-before-write journey, `NOT CANONICAL` marking, recorded-panel defaults, presets, and advisory challenge behaviour.

**Non-goals**

- No reordering of DOM versus visual order, no CSS `order` tricks, no "collapse all authoring sections".
- No Q3 disclosure work, no Stage 2/Q3, no S2/S3/S4, no new presets.
- No changes to validity rules, draft contract, API, schema, migrations, or canonical data; no autosave.
- No new persistence of disclosure or expansion state.
- No fix for `as-truth-cards-z6q` (populated step-row horizontal overflow); that remains Stage 3 work.

---

## 4. Recommended design (A1, revised)

### 4.1 Compact bar — genuinely one row

The compact bar is a single `flex items-center gap-2` row. There is no second line for the disclosure affordance, and the ≤48px target covers the entire bar including its controls.

```text
┌ Fixed header (95px) ──────────────────────────────────┐
│ Trope Deck / research context                        │
├──────────────────────────────────────────────────────┤
│ Your decomposition draft        NOT CANONICAL        │
│ [Start authoring]                                    │
│ ╔ sticky ≤48px, one row ════════════════════════════╗ │
│ ║ Unsaved · 1 issue  [Review 1 issue] [⋯ More]      ║ │
│ ╚═══════════════════════════════════════════════════╝ │
│ What is the assertion?  formal term: working claim   │
│   [Example]                                          │
│ [Add working assertion]                              │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

Slot rules:

1. **Status block** (`min-w-0`, flexible): status text plus an optional short detail. Only the detail may be CSS-truncated with an ellipsis; the status word and the issue count are never truncated visually or in the accessible text. The complete issue text stays in the authoritative banner.
2. **Contextual action** (fixed): exactly one real button, never both Save and Review.
3. **`More save actions` button** (fixed, 44×44px): accessible name `More save actions`, `aria-expanded`, `aria-controls="compose-save-actions"`. The visible glyph is `⋯` plus `More` when space allows; the accessible name is stable regardless of the visible abbreviation.

### 4.2 Slim bar while editing

```text
╔ sticky ≤44px, one row ════════════════════════════════╗
║ Unsaved · 1 issue  [Review 1 issue] [⋯ More]          ║
╚═══════════════════════════════════════════════════════╝
  Assertion [focused input]      ← lands at ≤160px
  Label     [next visible input]
```

Slim mode applies when a draft editor control has focus and focus is not inside the save bar. The three slots and their hit areas are unchanged; only the bar's visual padding/height shrinks. Tabbing into the bar, or activating `More`, restores the compact layout. There is no "tap anywhere on the bar" handler and no nested interactive controls.

The original 32px visual target is **revised to 44px**: a 32px visual bar cannot host 44×44px touch targets without overlapping or clipping them. The revision still reclaims ~55px from the accepted 99px blocked bar, and keeps focus/scroll geometry safe. A2 (compact-only) remains the fallback if focus detection proves unreliable.

### 4.3 State matrix

| State | Status (polite live region) | Short detail in status block | Single contextual action | Revealed action region |
|---|---|---|---|---|
| Pristine empty | `No draft saved yet.` | none | none | Save / Discard / Delete disabled |
| Pristine saved, valid | `Saved at HH:MM` | none | none | Delete enabled; Save / Discard disabled |
| Pristine saved, invalid | `Saved at HH:MM` | `{n} issues to fix` | `Review {n} issues` | Delete enabled; Save / Discard disabled |
| Dirty, valid | `Unsaved changes` | `Ready to save.` | `Save draft` | Discard / Delete |
| Dirty, blocked | `Unsaved changes` | `{n} issues to fix before saving` | `Review {n} issues` | Save (`aria-disabled`), Discard / Delete |
| Saving | `Saving…` | none | Save, natively `disabled` | disabled |
| Save failed | `Unsaved changes` | exact server message in `role="alert"` | `Save draft` (still actionable) | Discard / Delete |

Notes:

- The count is always present in the visible `Review {n} issues` label and in the full banner. If the short detail ellipsizes at 375px, the complete detail remains in the DOM for assistive technology and in `#compose-issues`; nothing is removed or rewritten.
- The accepted concise saved-invalid copy remains the detail text; its visible truncation, if any, is a width accommodation, not a copy change.
- The failure state is exempt from the ≤48px target: the exact server message must stay verbatim and visible within the previously accepted ≤104px ceiling. The redundant `Ready to save.` stays suppressed while an alert is shown.
- `Review {n} issues` keeps its behaviour: focus and scroll `#compose-issues`, mutate nothing, persist nothing, never touch the canonical graph. Save and Review never share the contextual slot.

### 4.4 Expansion control and revealed actions

- One real button controls the secondary actions in both compact and slim states: `<button type="button" aria-expanded={actionsOpen} aria-controls="compose-save-actions">More save actions</button>`. It is a sibling of the status block and contextual action, never their parent.
- The revealed region `id="compose-save-actions"` is rendered **in-flow below the bar**, pushing following content down. It is not fixed, absolute, or an overlay. It contains the same single Save, Discard and Delete controls with their existing labels, disabled states, `aria-disabled`, deletion safeguards, and exact copy.
- On activation: `aria-expanded` becomes `true` and focus remains on the `More` button. Tab moves to the first enabled action in the revealed region. Escape closes the region and returns focus to the `More` button. Activating the button again closes it and keeps focus on the button.
- No programmatic scrolling occurs on open or close; measured `scrollY` before and after must be unchanged. On a short viewport with the keyboard raised, the region uses `max-height: min(40vh, 168px)` with `overflow-y: auto` and `overscroll-behavior: contain`, so all three actions remain reachable by ordinary scrolling without covering the focused field or the bar.
- The native `<details>/<summary>` pattern remains an acceptable fallback implementation of this same one-button/one-region contract, but a bare `<summary>` does not satisfy the explicit button/`aria-expanded` requirement and will not be used for the slim control.

### 4.5 Touch and visual targets

- Every interactive control in the bar and its revealed region has a hit area of at least **44×44px**, including the slim-mode expansion button and contextual action.
- Visual-height targets: compact ≤48px, slim ≤44px, save-failure ≤104px (verbatim alert exempt). Desktop remains 67px at 88px.
- If 44px hit areas plus one row cannot fit at 375px, the row stays one row and the *text* slots shrink/truncate — never the buttons. The final measured heights are recorded in the handoff, not assumed from this proposal.

### 4.6 Scroll geometry and `Start authoring`

- Keep `--compose-sticky-top` at 104px (mobile) / 88px (desktop).
- Set mobile `--compose-scroll-margin-top` to approximately **152px** as a test starting point (header 95 + compact bar ~48 + ~9px clearance); tune in-browser and record the final value. Slim mode has more clearance, not less. Desktop stays 168px.
- Add a mobile-only `<button type="button">Start authoring</button>` in the draft heading row with `aria-controls="compose-editor-region"`. Activating it focuses the first editor control using the existing scroll margin. It performs an action, so it is not an anchor or a navigation; DOM order remains picker → recorded summary → draft.
- Recorded-panel defaults and all question headings/presets stay exactly as accepted.

### 4.7 Why no duplicate bar

The accepted proposal rejected "non-sticky bar + miniature status pill" because it duplicates controls and live regions and makes focus ambiguous. A1 avoids that: there is still one `SaveBar` instance, one `role="status"`, one `role="alert"`, one `More` button, and one issue banner. Only its mobile layout, disclosure depth and focus-aware sizing change.

---

## 5. Options considered

| Option | Verdict | Reason |
|---|---|---|
| **A1 — compact one-row bar + focus-aware slim mode + tighter scroll margin** | **Approved in principle; revised here** | Reclaims ~51px compact / ~55px slim; keeps one bar and one live region; available font/token changes only. |
| A2 — compact bar only (no focus-aware slim mode) | Fallback | Simpler and avoids focus-detection edge cases; reclaims ~51px. |
| B — bottom-fixed action bar | Rejected | Collides with the on-screen keyboard and covers the last field; already rejected in the accepted proposal. |
| C — non-sticky bar + duplicate status pill | Rejected | Duplicate controls and live regions, ambiguous focus; already rejected. |
| D — auto-hide on scroll-down, reveal on scroll-up | Rejected | Hides status unpredictably, needs a scroll listener, unfriendly to keyboard/screen-reader users. |
| E — status-only sticky line with Save moved to the end of the editor | Rejected for this phase | Save state would not stay reachable from the middle of a long draft; would reopen a settled Q5 decision. |

---

## 6. Implementation footprint (only if separately authorized)

- `src/compose/compose-editor.tsx` — one-row compact/slim bar layout, real `More save actions` button with `aria-expanded`/`aria-controls`, in-flow action region, contextual action selection; preserve testids, ARIA wiring, exact copy and deletion safeguards.
- `src/pages/Compose.tsx` — mobile `Start authoring` semantic button; focus state only if `:has()` is not used.
- `src/index.css` — mobile `--compose-scroll-margin-top` token and compact/slim bar rules; desktop tokens unchanged.
- `src/compose/compose-editor.test.tsx`, `src/pages/Compose.test.tsx` — one-row/state-matrix, touch-target sizing, disclosure focus/scroll, DOM-order and no-mutation assertions.
- `docs/COMPOSE_DESIGN_HANDOFF.md` and `docs/compose/screenshots/` — refreshed measurements and screenshots.

No changes to `server/`, `trope-cards/`, draft contract, validation semantics, API, schema, migrations, or canonical data. No packages added.

---

## 7. Accessibility and keyboard checks

- Status remains `role="status" aria-live="polite" aria-atomic="true"`; failures remain `role="alert"` with the exact server message; `aria-describedby` continues to point Save at the active alert or blocker.
- `More save actions` is a real button with a stable accessible name and accurate `aria-expanded`/`aria-controls`; focus stays predictable on open, Tab enters the revealed region, Escape closes and restores focus. Keyboard and screen-reader operation must be verified in both compact and slim states.
- The contextual action is a real button with an accurate accessible name; Save and Review never share the slot.
- Touch targets are ≥44×44px in compact, slim and revealed states; visual height is never bought by shrinking hit areas.
- `:has()`-based focus detection degrades to A2 (compact row only) in older browsers; no control disappears in the fallback.
- `scroll-margin-top` is applied to the recorded panel, editor sections, cards, focusable controls, and issue banner so focus never lands under the header or bar.

---

## 8. Verification and acceptance criteria (if implemented)

**Real-device requirement:** repeat with the on-screen keyboard raised on the device/emulator used for `as-truth-cards-fb0`, at 375px CSS width. Record device, browser/OS, keyboard state, measurements and a screenshot against that bead. Browser viewport emulation alone is not sufficient to close it.

| Criterion | Target |
|---|---|
| Compact bar height at 375px | ≤48px in clean, dirty-valid, blocked and saved-invalid states; status, one action and `More` all on one row |
| Slim bar height with an editor control focused | ≤44px visual, with ≥44×44px hit areas |
| Save-failure bar | Exact message visible; ≤104px; Save actionable |
| Touch targets | ≥44×44px for `More`, contextual action and revealed actions in compact, slim and keyboard-raised states |
| Focused input top at 375×420 with keyboard-like viewport | ≤160px |
| Controls visible below focused field | Focused field plus at least 2 further editor controls fully visible |
| `More` with keyboard raised at short height | Revealed region in-flow, not overlay; all three actions reachable; no obscured controls; `scrollY` unchanged on open/close |
| Focus behaviour | Focus stays on `More` on activation; Tab enters revealed actions; Escape closes and returns focus; visible focus indicator at every step |
| Screen reader / keyboard | State, label and `aria-expanded` announced correctly in compact and slim states; no nested interactive controls |
| Full issue banner | Reachable via `Review {n} issues`; complete text visible; `scrollHeight === clientHeight` when the list is short |
| Desktop regression | 1440px bar remains 67px at 88px; scroll margin 168px; banner clear |
| No mutation | Disclosure, `Start authoring`, Review and focus changes leave draft, dirty flag, saved row, canonical graph and scroll position untouched |

**Gates:** focused Compose tests; `pnpm run test:ui`; `pnpm run typecheck`; `pnpm exec biome check`; `pnpm run lint`; `pnpm run build`; `git diff --check`; read-only vision QA on refreshed screenshots.

---

## 9. Risks and attack checks

| Angle | Finding and mitigation |
|---|---|
| Touch operability | Revision 0's 32px slim target could not host comfortable hit areas; revised to 44px with ≥44×44px buttons. This is an intentional ~12px trade-off, not a compromise on operability. |
| Browser support | `:has()` fallback is A2; verify in the target mobile browsers during real-device QA. |
| Destructive action discoverability | `Delete saved draft` moves behind the real `More` button, explicitly allowed by the maintainer provided its label and safeguards remain unchanged; if that is later vetoed, keep Delete inline and reveal only Discard. |
| Text truncation | Long statuses may ellipsize the short detail at 375px; the count stays in the `Review {n} issues` label, full text stays in the DOM and banner, and status/action buttons never truncate. |
| Exact alert wrapping | A long server message can exceed the compact target; the failure state keeps the accepted ≤104px ceiling and verbatim text. |
| Token drift | Sticky top and scroll margin must change together; acceptance remeasures header bottom, bar top and focused-field top at both breakpoints. |
| Scroll jumps | The revealed region is in-flow and never moves focus programmatically; `scrollY` equality is an explicit test, not an assumption. |
| Regression to accepted decisions | Reviewed against Stage 1 acceptance: DOM order, read-first, recorded-panel defaults, presets, challenge advisory, single banner, concise saved-invalid copy and deletion safeguards are preserved. |
| Rollback | Presentation-only; reverting the commits, screenshots and doc restores the accepted Stage 1 layout with no data migration. `as-truth-cards-z6q` remains untouched. |

---

## 10. Scope boundary and status

**Building only if separately authorized:** the revised A1 mobile refinement in §4, with its tests, screenshots and handoff update. This revision is **not** implementation authorization.

**Not building:** Stage 2/Q3, S2/S3/S4, reorder work, new presets, autosave, validation/contract/API/schema/migration/canonical-data changes, and the `z6q` overflow fix.

**Resolved from maintainer review:** A1 direction; A2 fallback; secondary actions behind a real button with `aria-expanded`; `Delete saved draft` behind `More` with label/safeguards intact; ~152px scroll margin as a starting point; `Start authoring` as a semantic button.

**Unresolved trade-offs for this review:**

1. Slim visual height is **44px, not 32px**, so 44×44px touch targets remain operable. This is the only deliberate change to the approved-in-principle numbers.
2. The short status detail may ellipsize at 375px; the count remains in the action label and full details in the authoritative banner.
3. `as-truth-cards-fb0` still needs real-device or suitable-emulator evidence with the OS keyboard raised; no pass is claimed from emulation.

No implementation starts without an explicit maintainer decision, and issue #16 stays open with Stage 2/Q3 still gated.
