import express from 'express';
import cors from 'cors';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import cardsRouter from './api/cards.js';
import interactionsRouter from './api/interactions.js';
import graphRouter from './api/graph.js';

const app = express();
const PORT = process.env.PORT || 3001;

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(currentFilePath));
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());

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
app.use('/api/graph', graphRouter);

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

if (isProduction) {
  app.use(express.static(path.join(projectRoot, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(projectRoot, 'dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;