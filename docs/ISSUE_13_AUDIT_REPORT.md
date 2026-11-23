# Issue #13 — avatar / Save Card gate / safe-return audit (2026-11-23)

## Scope and boundary

Verification-only audit of already-landed Issue #13 account work. No onboarding
flow, auth contract, avatar route or account page was reimplemented. The audit
inspected the current tree, added two missing test cases for concrete coverage
gaps, and ran the repository's available local gates.

Status vocabulary is kept separate:

- **implemented** — code/structure exists;
- **locally verified** — a repeatable local command passed;
- **manually verified** — a human/browser observation was made (none in this slice);
- **blocked** — cannot be established in this environment;
- **release-verified** — deployed/production evidence (none in this slice).

Audited tree: local `main` at `d578418dedde6ed85443f8d1b647c741eb5f852c`, plus
the two test additions in this change. Environment: Node `v24.10.0`, pnpm
`11.8.0`, Linux. No `TROPE_GRAPH_DATABASE_URL` / `DATABASE_URL` was available;
no live Neon/destructive check was run.

## Contracts inspected

### Avatar

```
File (Settings)
  -> src/auth/avatar.ts: validate -> POST/DELETE /api/me/avatar (session cookie)
  -> server/api/avatars.ts: origin guard -> session actor -> magic-byte sniff
  -> user_avatars(userId, mimeType, data) + user.image = versioned public URL
  -> GET /api/users/:id/avatar?v=<sha256> (public, ETag/immutable cache)
  -> src/hooks/session-context.tsx refetch -> Header / Account / settings preview
  -> src/components/account/public-profile-card.tsx initials fallback
```

Evidence: `prisma/schema.prisma` (`User.image`, `UserAvatar` with cascade),
`prisma/migrations/20261026000000_add_user_avatars/migration.sql`,
`server/api/avatars.ts`, `src/auth/avatar.ts`, `src/pages/AccountSettings.tsx`,
`src/hooks/session-context.tsx`, `src/components/account/avatar-panel.tsx`,
`src/components/account/public-profile-card.tsx`.

The bytes are explicitly kept **off** the user row so a session read never
carries ~500 KB; `user.image` carries only the short public URL. The panel says
the photo is public profile presentation, not a research credential. Participation
answers and appearance remain device-local (`localStorage`) and are labelled as
such; they are not written to the account or to `trope_graph`.

### Save Card and return context

`src/deck/card-save-button.tsx` renders a disabled `Save card` with the visible
reason "Sign in to save cards to your account." for signed-out readers, and a
server-backed check/save/unsave toggle for signed-in readers. The disabled
branch was an explicit earlier decision (commit `e8346a6`) and is not a regression.

`src/auth/journey.ts::safeReturnTo` sanitises `returnTo` to a same-origin path:
it rejects protocol-relative (`//host`), backslash (`/\host`), absolute URLs,
whitespace and C0/C1/DEL control characters, falling back to `/account`. Both
`SignIn.tsx` and `SignUp.tsx` navigate to `submitSignIn`/`submitSignUp`'s
sanitised redirect. Other account surfaces build explicit safe paths such as
`/sign-in?returnTo=/account/settings` and `/sign-in?returnTo=/onboarding`.

## Concrete gaps found and fixed

Both gaps were **test coverage**, not product defects. No production code was
changed.

1. `server/api/avatars.test.ts` — the upload route's account isolation was not
   asserted. Added a test that seeds `user-2`'s avatar, uploads as `user-1`, and
   proves `user-2`'s bytes and `user.image` are untouched while `user-1` is
   written.
2. `src/components/account/account-panels.test.tsx` — the avatar panel's privacy
   copy was not asserted. Added a test pinning "Your photo is public alongside
   your display name." and "It is profile presentation, not a research
   credential."

## Criterion-by-criterion evidence

| Criterion | Implementation state | Local evidence | Manual / release status |
|---|---|---|---|
| Avatar bytes live on the account, not the device or the graph | implemented | `prisma/schema.prisma` `UserAvatar` + cascade; `server/api/avatars.ts` store port; no avatar/account field in `trope-cards` (`grep`) | locally verified by schema/code inspection; real Neon persistence blocked |
| Versioned public URL in `User.image` | implemented | `publicAvatarUrl` unit test; route test asserts `user.image` equals the versioned URL; ETag/404/304 tests in `server/api/avatars.test.ts` | locally verified with in-memory store; remote-DB round trip blocked |
| Retrieval across sessions/devices | implemented | account row is server-backed; `SessionProvider.refetch` re-reads after upload/removal; session-state tests cover `image` mapping | locally verified at contract level; real cross-device browser session not manually verified |
| Initials fallback when no image | implemented | `initialOf()` test + `AvatarPanel` initials/empty tests in `account-panels.test.tsx` | locally verified |
| Privacy expectations in UI copy | implemented | new `AvatarPanel` copy test above | locally verified |
| Local preferences stay separate from account | implemented | `src/onboarding/preferences.ts` + tests; `AccountSettings.tsx` says "stored on this device"; no account column | locally verified |
| Save Card gate | implemented | `src/deck/card-save-button.test.tsx`; `featured-card.test.tsx` asserts disabled signed-out state with visible reason; signed-in toggle uses `/api/saved-cards` | locally verified; live account save not manually verified |
| Account-required route prompts | implemented | `Account`, `Onboarding`, `AccountActivity`, `AccountSettings` render signed-out prompts with safe `returnTo` paths | inspected; browser route walkthrough not manually verified |
| `returnTo` open-redirect safety | implemented | `src/auth/journey.unit.test.tsx` covers `//host`, `/\host`, absolute URLs, whitespace, backslashes, C0/C1/DEL and non-strings; `submitSignIn`/`submitSignUp` use `safeReturnTo` | locally verified |
| Account identity/participation out of `trope_graph` | implemented | `grep` over `trope-cards/src`/`trope-cards/prisma` finds no account/avatar/preference fields | locally verified by inspection |
| Repository gates | implemented | full gate run below | locally verified; graph DB gate blocked |

## Commands and results

Run from the repository root on the audited tree:

| Command | Result |
|---|---|
| `node --import tsx --test server/api/avatars.test.ts` | 19 tests, 19 pass, 0 fail |
| `TSX_TSCONFIG_PATH=./tsconfig.app.json node --import tsx --import ./scripts/preact-test-alias.mjs --test src/components/account/account-panels.test.tsx` | 26 tests, 26 pass, 0 fail |
| `TSX_TSCONFIG_PATH=./tsconfig.app.json node --import tsx --import ./scripts/preact-test-alias.mjs --test src/auth/avatar.test.tsx src/auth/journey.unit.test.tsx src/account/saved-cards-model.test.tsx src/deck/card-save-button.test.tsx src/deck/featured-card.test.tsx src/hooks/session-envelope.test.tsx src/hooks/session-state.test.tsx src/onboarding/preferences.test.tsx` | 128 tests, 128 pass, 0 fail (before the two additions) |
| `pnpm run test` | server 190/190; graph 506/506; UI 806/806; 0 fail |
| `pnpm run typecheck` (`tsc -b`) | pass |
| `pnpm run build` | pass |
| `pnpm run lint` | exit 0; 1 pre-existing warning (see below) |
| `pnpm run trope-graph:check -- --allow-remote` | **blocked**: `No database connection string found. Set TROPE_GRAPH_DATABASE_URL, or DATABASE_URL to share the host application's connection.` |

The two added tests are included in the `pnpm run test` totals above. The
previously reported UI/server/graph totals were 805/189/506; the UI and server
counts each rose by one with these tests.

Lint warning: `src/sources/research-metrics.tsx:8` has an unused
`ComponentChildren` type import. That file is untouched by this audit; the
warning predates the change (tracked as `as-truth-cards-ptf`) and is not a
regression. Biome reports `Found 1 warning` and exits 0.

## Not established by this audit

- No live database was contacted. Real Prisma persistence of `user_avatars` and
  `user.image`, and retrieval from a different device/browser, remain **blocked**.
- No browser was driven. Responsive layout, keyboard focus, and the live
  sign-in → onboarding → account walkthrough were not manually re-verified here.
- Figma visual parity was not re-inspected in this slice; earlier frame-content
  reads were rate-limited and the mapping remains inventory-derived.
- Nothing here is **release-verified**. Issue #9 stays open.

## Conclusion

Issue #13's avatar contract, Save Card gate and `returnTo` sanitisation are
present and internally consistent. With the two added tests, the locally
automatable criteria are verified. Database, cross-device, browser and Figma
acceptance remain open and must not be described as complete on this report.
