# Mobile Compose authoring proposal — focused editing with a compact save bar

**Status:** proposal only. **Not authorized for implementation.** Submitted for maintainer review arising from the Stage 1 acceptance decision (gh#16 comment `7133750518`) and the maintainer's 2026-11-24 feedback that the sticky save bar competes for mobile screen space while the author must scroll to reach inputs.

This is presentation and interaction design only. It proposes a narrowly scoped, separately gated "Stage 1.5" refinement. It does **not** change the draft contract, validation semantics, save API, database schema, migrations, canonical graph or data, and it does not begin Stage 2/Q3 or S2/S3/S4. Issue #16 stays open as the umbrella.

## 1. Decision summary

| Question | Recommendation | One-line decision |
|---|---|---|
| Mobile save bar | **A1 — one-row compact bar, slim while editing** | Keep one sticky bar and one live region; show status + one contextual action inline, move Discard/Delete into a native disclosure in the same bar. |
| Focus behaviour | **A1 — slim mode while an editor control has focus** | Reduce the bar to status + one action (~32px) when the keyboard is in use; expand on tap or when focus enters the bar. A2 (compact-only) is the fallback. |
| Scroll geometry | **Tighten mobile scroll margin** | Reduce the mobile `scroll-margin-top` from 228px to ~152px so a focused field lands just below the header and compact bar; desktop stays 168px. |
| Input discovery | **Mobile-only `Start authoring` link** | One link in the draft heading focuses the first editor control; DOM order remains picker → recorded summary → draft. |
| Full validation list | **Unchanged** | `#compose-issues` stays the single authoritative banner with complete issue text; the bar only summarizes counts. |

Official/platform primitives remain the first choice: native `<details>/<summary>`, native buttons, CSS `position: sticky`, `scroll-margin-top`, and existing Tailwind/token patterns. No new library, service, credential or MCP dependency is required.

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

The maintainer reports that the mobile keyboard itself works. That is welcome, but `as-truth-cards-fb0` remains open until the device evidence is recorded against it; this proposal does not close that follow-up.

---

## 3. Goals and non-goals

**Goals**

- Give the focused editor control and its neighbours usable vertical space at 375px with the keyboard raised.
- Keep save state reachable and blockers distinguishable from real save failures (the accepted Q5 contract).
- Keep one bar, one status live region, and one authoritative issue banner — no duplicate controls or announcements.
- Preserve the accepted read-before-write journey, `NOT CANONICAL` marking, recorded-panel defaults, presets, and advisory challenge behaviour.

**Non-goals**

- No reordering of DOM versus visual order, no CSS `order` tricks, no "collapse all authoring sections".
- No Q3 disclosure work, no Stage 2/Q3, no S2/S3/S4, no new presets.
- No changes to validity rules, draft contract, API, schema, migrations, or canonical data.
- No autosave, no new persistence of disclosure or expansion state.
- No fix for `as-truth-cards-z6q` (populated step-row horizontal overflow); that remains Stage 3 work.

---

## 4. Recommended design (A1)

### 4.1 Mobile layout — blocked draft, compact state

```text
┌ Fixed header (95px) ──────────────────────────────────┐
│ Trope Deck / research context                        │
├──────────────────────────────────────────────────────┤
│ Your decomposition draft        NOT CANONICAL        │
│ Start authoring ↓                                    │
│ ╔ sticky ≤48px ═════════════════════════════════════╗ │
│ ║ Unsaved changes · 1 issue   [Review 1 issue]      ║ │
│ ║ ▸ More                                           ║ │
│ ╚═══════════════════════════════════════════════════╝ │
│ What is the assertion?  formal term: working claim   │
│   [Example]                                          │
│ [Add working assertion]                              │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

`More` is a native `<details>` inside the same bar; opening it reveals `Save draft`, `Discard changes` and `Delete saved draft` in place, pushing content down rather than overlaying it. It is never a second bar or a second live region.

### 4.2 Mobile layout — focused field, slim state

```text
╔ sticky ≤32px ═════════════════════════════════════════╗
║ Unsaved changes · 1 issue        [Review 1 issue]    ║
╚═══════════════════════════════════════════════════════╝
  Assertion [focused input]
  Label     [next visible input]
```

Slim mode applies only when a draft editor control has focus and focus is not inside the bar. Tapping the slim bar, or tabbing into it, restores the compact row with `More`. The status text and the single contextual action remain visible in both states, so the save state is never hidden while typing.

### 4.3 State matrix (unchanged copy where already accepted)

| State | Status (polite live region) | Compact detail | Inline action | Inside `More` |
|---|---|---|---|---|
| Pristine empty | `No draft saved yet.` | none | none | Save / Discard / Delete disabled |
| Pristine saved, valid | `Saved at HH:MM` | none | none | Delete enabled; Save / Discard disabled |
| Pristine saved, invalid | `Saved at HH:MM` | `{n} issues to fix` | `Review {n} issues` | Delete enabled; Save / Discard disabled |
| Dirty, valid | `Unsaved changes` | `Ready to save.` | `Save draft` | Discard / Delete |
| Dirty, blocked | `Unsaved changes` | `{n} issues to fix before saving` | `Review {n} issues` | Save (`aria-disabled`), Discard / Delete |
| Saving | `Saving…` | none | Save, natively `disabled` | disabled |
| Save failed | `Unsaved changes` | exact server message in `role="alert"` | `Save draft` (still actionable) | Discard / Delete |

Notes:

- The saved-invalid copy stays exactly the accepted concise `Saved draft · {n} issues to fix` wording where it appears in the bar; the full issue text remains only in `#compose-issues`.
- The failure state is exempt from the ≤48px compact target: the exact server message must stay verbatim and visible. It remains within the previously accepted ≤104px ceiling, and the redundant `Ready to save.` stays suppressed while an alert is shown.
- `Review {n} issues` keeps its current behaviour: focus and scroll `#compose-issues`, mutate nothing, persist nothing, never touch the canonical graph.

### 4.4 Scroll geometry and input discovery

- Keep `--compose-sticky-top` at 104px (mobile) / 88px (desktop).
- Set mobile `--compose-scroll-margin-top` to approximately **152px** (header 95 + compact bar ~48 + ~9px clearance); tune in-browser and record the final value. Slim mode has more clearance, not less. Desktop stays 168px.
- Add a mobile-only `Start authoring` link in the draft heading row. It focuses the first editor control using the same scroll margin; it is a button styled as a link, not navigation, and does not reorder the page.
- Recorded panel defaults and all question headings/presets stay exactly as accepted.

### 4.5 Why no duplicate bar

The accepted proposal rejected "non-sticky bar + miniature status pill" because it duplicates controls and live regions and makes focus ambiguous. A1 avoids that: there is still one `SaveBar` instance, one `role="status"`, one `role="alert"`, and one issue banner. Only its mobile layout and disclosure depth change.

---

## 5. Options considered

| Option | Verdict | Reason |
|---|---|---|
| **A1 — compact one-row sticky bar + focus-aware slim mode + tighter scroll margin** | **Recommended** | Reclaims ~50px in compact mode and ~70px while typing; keeps one bar and one live region; no new dependency. |
| A2 — compact bar only (no focus-aware slim mode) | Viable fallback | Simpler and avoids `:has()`/focus logic; reclaims ~50px but leaves less room with the keyboard raised. |
| B — bottom-fixed action bar | Rejected | Collides with the on-screen keyboard and covers the last field; already rejected in the accepted proposal. |
| C — non-sticky bar + duplicate status pill | Rejected | Duplicate controls and live regions, ambiguous focus; already rejected. |
| D — auto-hide on scroll-down, reveal on scroll-up | Rejected | Hides status unpredictably, needs a scroll listener, and is unfriendly to keyboard/screen-reader users. |
| E — status-only sticky line with Save moved to the end of the editor | Rejected for this phase | Save state would not stay reachable from the middle of a long draft; would reopen a settled Q5 decision. |

---

## 6. Implementation footprint (only if authorized)

- `src/compose/compose-editor.tsx` — mobile compact/slim bar layout, `More` disclosure, contextual action selection; preserve existing testids, ARIA wiring, and exact copy.
- `src/pages/Compose.tsx` — mobile `Start authoring` link; focus state only if `:has()` is not used.
- `src/index.css` — mobile `--compose-scroll-margin-top` token and compact/slim bar rules; desktop tokens unchanged.
- `src/compose/compose-editor.test.tsx`, `src/pages/Compose.test.tsx` — state matrix, one-live-region, disclosure, DOM-order and no-mutation assertions.
- `docs/COMPOSE_DESIGN_HANDOFF.md` and `docs/compose/screenshots/` — refreshed measurements and screenshots.

No changes to `server/`, `trope-cards/`, draft contract, validation semantics, API, schema, migrations, or canonical data. No packages added.

---

## 7. Accessibility and keyboard checks

- Status remains `role="status" aria-live="polite" aria-atomic="true"`; failures remain `role="alert"` with the exact server message; `aria-describedby` continues to point Save at the active alert or blocker.
- `More` uses native `<details>/<summary>`; keyboard operation and focus visibility are unchanged. Focusing or tapping the slim bar expands it, so no control is permanently hidden.
- The contextual inline action is a real button with existing labels; `Review` and `Save` never both claim the same inline slot.
- `:has()`-based focus detection degrades to A2 (compact row only) in older browsers; no control disappears in the fallback.
- `scroll-margin-top` is applied to the recorded panel, editor sections, cards, focusable controls, and issue banner so focus never lands under the header or bar.

---

## 8. Verification and acceptance criteria (if implemented)

**Real-device requirement:** repeat with the on-screen keyboard raised on the device/emulator used for `as-truth-cards-fb0`, at 375px CSS width. Record device, browser/OS, keyboard state, measurements and a screenshot against that bead. Emulation alone is not sufficient to close it.

| Criterion | Target |
|---|---|
| Compact bar height at 375px | ≤48px in clean, dirty-valid, blocked and saved-invalid states |
| Slim bar height with an editor control focused | ≤32px |
| Save-failure bar | Exact message visible; ≤104px; Save actionable |
| Focused input top at 375×420 with keyboard-like viewport | ≤160px |
| Controls visible below focused field | Focused field plus at least 2 further editor controls fully visible |
| Full issue banner | Reachable via `Review {n} issues`; complete text visible; `scrollHeight === clientHeight` when the list is short |
| Desktop regression | 1440px bar remains 67px at 88px; scroll margin 168px; banner clear |
| No mutation | Disclosure, `Start authoring`, Review and focus changes leave draft, dirty flag, saved row and canonical graph untouched |

**Gates:** focused Compose tests; `pnpm run test:ui`; `pnpm run typecheck`; `pnpm exec biome check`; `pnpm run lint`; `pnpm run build`; `git diff --check`; read-only vision QA on refreshed screenshots.

---

## 9. Risks and attack checks

| Angle | Finding and mitigation |
|---|---|
| Browser support | `:has()` fallback is A2; verify in the target mobile browsers during real-device QA. |
| Destructive action discoverability | `Delete saved draft` moves behind `More`. This is a deliberate UX trade-off needing explicit approval; the label stays explicit and the action remains one tap away. If vetoed, keep Delete inline and put only Discard behind `More`. |
| Exact alert wrapping | A long server message can exceed the compact target. Failure state keeps the accepted ≤104px ceiling and verbatim text; no truncation. |
| Token drift | Sticky top and scroll margin must be changed together; acceptance remeasures header bottom, bar top and focused-field top at both breakpoints. |
| Regression to accepted decisions | Reviewed against Stage 1 acceptance: DOM order, read-first, recorded-panel defaults, presets, challenge advisory, single banner and concise saved-invalid copy are all preserved. |
| Rollback | Presentation-only; reverting the commits, screenshots and doc restores the accepted Stage 1 layout with no data migration. `as-truth-cards-z6q` remains untouched. |

---

## 10. Scope boundary and decision requested

**Building only if approved:** the A1 mobile refinement in §4, with its tests, screenshots and handoff update.

**Not building:** Stage 2/Q3, S2/S3/S4, reorder work, new presets, autosave, validation/contract/API/schema/migration/canonical-data changes, and the `z6q` overflow fix.

**Decision requested:**

1. Approve **A1** (recommended), approve **A2** (compact-only fallback), or reject and keep the accepted Stage 1 layout.
2. If A1/A2 is approved, confirm whether `Delete saved draft` may sit behind `More`, or must remain inline.
3. Confirm the real-device keyboard evidence for `as-truth-cards-fb0` and who will record it there.

Until that decision is recorded, no implementation begins and issue #16 stays open with Stage 2/Q3 still gated.
