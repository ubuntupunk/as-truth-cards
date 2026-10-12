# Issue #10 — Security review: CORS policy and trusted-proxy/IP assumptions

> **Status:** decision + review task, closed by the implementation below.
> This is a **review**, not a demonstrated vulnerability: the shipped policy is the
> Express package default (`cors()` reflects any origin) and there is no `trust proxy`
> setting, both of which this document settles and the code now encodes.
> Follow-up from product-shell acceptance on #9 (landmark 9).

## Scope

- `server/index.ts:20` — `app.use(cors())`, the package default (reflects any origin, no
  allow-list, no credentials policy).
- No `trust proxy` setting — behind Render's reverse proxy, `req.ip` resolves to the proxy
  address, and `req.protocol`/`req.secure` do not reflect the public scheme.
- Better Auth "production config" — session-cookie `Secure`/`SameSite` flags behind the
  reverse proxy (Better Auth records IP/user-agent in account/session records).
- A regression test for the chosen policy in the server test suite.

## Findings (current state)

| # | Area | Observed |
|---|---|---|
| 1 | CORS | `server/index.ts:20` `app.use(cors())` — reflects `Access-Control-Allow-Origin: *` (no `credentials`), any origin. Consumers today: the Vite-bundled SPA (same-origin in production; `:8080` → Vite proxy → `:3001` in dev) and the Better Auth API on the same origin. **No cross-origin consumer exists or is planned** (no public API, no third-party SPA). See `vite.config.ts` (proxy `changeOrigin`) and `server/auth.ts:66-69` (`trustedOrigins` = `localhost:8080`, `localhost:3001`). |
| 2 | trust proxy | No `app.set('trust proxy', …)` anywhere. On Render the process is behind one reverse-proxy edge; without the setting `req.ip` is the proxy address and `req.protocol` is `http` even on public HTTPS. |
| 3 | Cookies | `server/auth.ts` sets no cookie config. Verified against Better Auth v1 docs (`/docs/reference/security`): **`Secure` is on by default when the base URL is `https`; `SameSite=Lax`; `httpOnly` on.** Production sets `BETTER_AUTH_URL=https://as-truth-cards.onrender.com`, so the defaults are already correct behind the render proxy; no change required. CSRF defense (Better Auth) is decided by its own Origin validation against `trustedOrigins`, independent of CORS. |
| 4 | Test | No CORS/header regression test in `server/**/*.test.ts` (only `drafts`, `auth-secret`, `draft-contract`). |

## Decisions

### 1. CORS — explicit allow-list, not same-origin-only; never the package default

The API has no sanctioned cross-origin consumer, so policy is effectively **same-origin**.
Rather than remove `cors()` outright (which would break any ad-hoc cross-origin dev
tooling that talks to `:3001` and would be opaque), the policy is an **explicit allow-list**:

- Sources: `CORS_ORIGINS` env var (comma-separated); when unset/empty, the default is the
  two known development origins (`http://localhost:8080`, `http://localhost:3001` — the
  same list Better Auth already trusts) plus, in production, the value of `BETTER_AUTH_URL`.
- `credentials: true` is set, but an allowed origin is required to receive any CORS
  header — `Access-Control-Allow-Origin` echoes the request origin; a disallowed origin
  gets **no** `Access-Control-Allow-Origin`, so the browser enforces the block.
- Non-browser requests (no `Origin`, e.g. curl, health checks, Render port-scans) are
  unaffected: no CORS headers are added, `200` as before.
- No wildcard (`*`) ever. Preflight is handled by the `cors` middleware on `OPTIONS`.

This keeps `cors()` but removes the "reflect any origin" property the review flagged; it
does not introduce a new trust surface.

### 2. trust proxy — trust exactly one hop (Render)

`app.set('trust proxy', 1)` is set before any handler. Effects (per Express "behind
proxies" docs):

- `req.ip` is derived from `X-Forwarded-For`, starting at the first address after the one
  trusted hop — Render's edge is the sole ingress, so this yields the client address.
- `req.protocol`/`req.secure` reflect `X-Forwarded-Proto`, so the app (and any future
  rate limiting or fraud signal) sees `https` on public requests.

**Precondition to confirm at deploy (provider-observed, not this session):** the last
trusted proxy — Render — must overwrite `X-Forwarded-For`/`X-Forwarded-Proto`. Express
warns of header spoofing otherwise. Render documents that it sets these headers on entry,
so `trust proxy: 1` is the standard Render/Express setting; a deploy check should confirm
`req.ip` shows a public address and `req.secure` is `true` on `/api/*` (see
`docs/issue-9/…` for the app-vs-provider attestation discipline). Dev (`:3001`, no proxy)
is unaffected — `req.ip` falls back to the socket address.

### 3. Cookies — Better Auth defaults are correct; no change

Better Auth v1 assigns **`Secure`** cookies when the base URL is `https`, `SameSite=Lax`
by default, and `httpOnly` on. Production already runs `BETTER_AUTH_URL=https://…`, so
no `advanced` cookie overrides are needed. This decision is recorded, not reimplemented;
if a sandbox/prod URL were ever served over plain HTTP, `Secure` would drop automatically
with the base URL — the correct behaviour.

### 4. Regression tests

`server/security-policy.test.ts` drives the real `createApp()` over HTTP and asserts:

- allowed origin → `Access-Control-Allow-Origin` echoes it + `credentials: true`;
- disallowed origin → no `Access-Control-Allow-Origin`;
- preflight (`OPTIONS`) allowed → `204` + `Access-Control-Allow-*`; disallowed → no CORS header;
- `CORS_ORIGINS` override is honoured (an outside origin allowed, an inside one denied);
- `trust proxy` → `req.ip` from `X-Forwarded-For`, `req.secure` from `X-Forwarded-Proto`;
- `/health` is unaffected and returns `{"status":"ok"}` with no Origin.

## Implementation

- `server/app.ts` (new) — `createApp({ env })` factory: `trust proxy` → CORS policy →
  Better Auth (`/api/auth/*`, mounted before `express.json()`) → JSON → routers → `/health`
  → production static + SPA catch-all. Env is injectable so tests stay hermetic.
- `server/index.ts` — thin: builds `createApp()` and `listen`s.
- `server/security-policy.test.ts` (new).
- `README.md` — `CORS_ORIGINS` in the environment table + a "Reverse proxy and origins"
  note.

## Residual / follow-ups

- **Verify at deploy (provider-observed):** Render header semantics → `req.ip` public,
  `req.secure` true. Not attestable without a deployed instance this session.
- If a real cross-origin consumer ever appears, it must be added to `CORS_ORIGINS`
  explicitly; the read surface (`/api/graph`, `/api/cards`) remains public by design —
  CORS is browser-enforcement, not resource authorization (authorization for
  `/api/interactions` is tracked separately in issue #11).