/**
 * Composition root for the Express app, extracted from `server/index.ts` so the security
 * policy (CORS allow-list, trusted proxy) can be reviewed and tested over real HTTP without
 * binding a port or importing the production env.
 *
 * The environment is injected as a small object rather than read from `process.env`
 * directly, so `createApp` is hermetic in tests: an explicit `NODE_ENV: 'test'` keeps the
 * static-bundle/catch-all branch off, and `CORS_ORIGINS`/`BETTER_AUTH_URL` shape the policy
 * deterministically.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import cardsRouter from './api/cards.js';
import interactionsRouter from './api/interactions.js';
import savedCardsRouter from './api/saved-cards.js';
import graphRouter from './api/graph.js';
import draftsRouter from './api/drafts.js';
import discoveryRouter from './api/discovery.js';
import accountRouter from './api/account.js';
import avatarsRouter from './api/avatars.js';
import {
  DEFAULT_TRUSTED_ORIGINS,
  resolveTrustedOrigins,
} from './lib/origin.js';

/**
 * The process-environment keys the app reads, narrowed so callers cannot inject an
 * unrelated value. Anything the auth module reads itself (e.g. `BETTER_AUTH_URL` for its
 * base URL) is deliberately absent here and left to `process.env`.
 */
export type AppEnv = {
  NODE_ENV?: string;
  BETTER_AUTH_URL?: string;
  CORS_ORIGINS?: string;
};

/**
 * The development origins the API trusts by default. Re-exported from the shared
 * origin module so CORS (here), Better Auth (`server/auth.ts`) and the CSRF origin
 * guard (`server/lib/origin.ts`) all read from one list and cannot drift.
 */
export const DEFAULT_CORS_ORIGINS: readonly string[] = DEFAULT_TRUSTED_ORIGINS;

/**
 * Resolve the browser origins the API will answer cross-origin. Thin alias of the
 * shared {@link resolveTrustedOrigins}, kept under its historical name for callers
 * and tests.
 *
 * @param env Injectable environment, defaulting to the process environment.
 * @returns A trimmed, de-duplicated list of origins; never contains a wildcard.
 * @example
 * ```ts
 * resolveCorsOrigins({ CORS_ORIGINS: 'https://app.example.com' });
 * // => ['https://app.example.com']
 * ```
 */
export function resolveCorsOrigins(env: AppEnv = process.env): string[] {
  return resolveTrustedOrigins(env);
}

/**
 * Build the Express application.
 *
 * Middleware order is load-bearing:
 *
 * 1. `trust proxy` — Render is a single reverse-proxy hop. This makes `req.ip` resolve to
 *    the client address from `X-Forwarded-For` and `req.secure`/`req.protocol` reflect the
 *    public scheme from `X-Forwarded-Proto` (see `docs/issue-10-security-review.md`).
 *    `1`, not `true`, so exactly one hop is trusted and the socket peer must be Render.
 * 2. CORS allow-list — an explicit origin policy (never the package default, never `*`).
 *    A disallowed browser origin receives no `Access-Control-Allow-Origin`, so the browser
 *    block is what rejects it; non-browser requests without an `Origin` are unaffected.
 * 3. Better Auth — must run before `express.json()`, which consumes the request stream.
 * 4. Routers, `/health`, then the production static bundle and SPA catch-all.
 *
 * @param env Injectable environment, defaulting to `process.env`.
 * @returns A configured, not-yet-listening Express app.
 */
export function createApp(env: AppEnv = process.env): express.Express {
  const app = express();

  app.set('trust proxy', 1);

  const corsOrigins = resolveCorsOrigins(env);
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, origin != null && corsOrigins.includes(origin));
      },
      credentials: true,
    }),
  );

  // Better Auth must be mounted before express.json(). The body parser consumes the
  // request stream, and Better Auth needs to read the raw body itself to verify webhook
  // and CSRF signatures. Registering it after would make every POST to /api/auth/*
  // arrive with an empty body.
  //
  // toNodeHandler returns a raw (IncomingMessage, ServerResponse) handler. Express
  // Request/Response extend those Node types, so the call is safe, but Express's
  // overloaded app.all signature does not narrow to it, hence the explicit adapter.
  // Rejections are forwarded to Express rather than becoming unhandled rejections.
  const authHandler = toNodeHandler(auth);
  app.all('/api/auth/*', (req, res, next) => {
    // At runtime req/res are genuine Node IncomingMessage/ServerResponse objects.
    // @types/express v4 predates properties that @types/node has since added to both
    // (`signal` on the request, `writeInformation` on the response), so Express's types
    // are not structurally assignable to the ones Better Auth declares. The casts bridge
    // that declaration gap and nothing else.
    authHandler(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    ).catch(next);
  });

  app.use(express.json());

  app.use('/api/cards', cardsRouter);
  app.use('/api/interactions', interactionsRouter);
  app.use('/api/saved-cards', savedCardsRouter);
  app.use('/api/graph', graphRouter);
  app.use('/api/drafts', draftsRouter);
  app.use('/api/discovery', discoveryRouter);
  app.use('/api/account', accountRouter);
  // Profile photos: the session's own write verbs under `/api/me`, the public
  // byte-serving read under `/api/users`. One router, two narrow mounts —
  // never a catch-all `/api` mount that would change how unknown paths
  // answer. `express.raw` is route-local inside the router, so it consumes
  // the stream only for the upload verb it is attached to.
  app.use('/api/me', avatarsRouter);
  app.use('/api/users', avatarsRouter);

  /**
   * Liveness probe, declared before the static handler and the SPA catch-all below.
   *
   * Order matters: `app.get('*')` answers every GET that reaches it, so a `/health` route
   * registered after it is unreachable in production and returns `index.html` instead of JSON.
   * Render's `healthCheckPath` accepts that 200, which makes the breakage invisible until
   * someone reads the body.
   */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (env.NODE_ENV === 'production') {
    const currentFilePath = fileURLToPath(import.meta.url);
    const projectRoot = path.dirname(path.dirname(currentFilePath));
    app.use(express.static(path.join(projectRoot, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(projectRoot, 'dist/index.html'));
    });
  }

  return app;
}