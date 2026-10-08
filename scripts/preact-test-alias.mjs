/**
 * `react` → `preact/compat` for the UI test run.
 *
 * The browser build aliases `react`, `react-dom` and the JSX runtimes to
 * Preact (`vite.config.ts`), so every dependency that imports `react` — the
 * icon set included — really runs against Preact in the app. The test runner
 * bypasses Vite, so without the alias those dependencies build *React*
 * elements while the tests render *Preact* vnodes, and
 * `preact-render-to-string` dies on `[object Object] is not a valid HTML tag
 * name`.
 *
 * The alias has to be applied twice, because a package without an `exports`
 * map is loaded through *both* loaders:
 *
 * - ESM imports go through the `resolve` hook in
 *   `preact-test-alias.hooks.mjs`.
 * - That same package's internal `require('react')` runs through the
 *   CommonJS resolver, which never sees ESM hooks — so `Module`'s filename
 *   resolution is patched here on the main thread.
 *
 * It is deliberately not a tsconfig path: types keep resolving to the
 * installed `react`, only the test run's module graph changes.
 *
 * Usage: `node --import tsx --import ./scripts/preact-test-alias.mjs --test …`
 */

import Module, { register } from 'node:module'
import { ALIASES } from './preact-test-alias.hooks.mjs'

register('./preact-test-alias.hooks.mjs', import.meta.url)

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  return resolveFilename.call(this, ALIASES.get(request) ?? request, ...rest)
}
