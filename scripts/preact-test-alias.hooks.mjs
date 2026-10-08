/**
 * The specifier map `preact-test-alias.mjs` applies — the same one
 * `vite.config.ts` uses, so a test and the browser resolve `react` to one
 * implementation.
 *
 * Exported from the hook module so the ESM hook and the CommonJS patch read
 * one list; importing this module on the main thread only builds the map and
 * defines `resolve`, it registers nothing.
 */

/** Specifiers remapped for the test run, mirroring the Vite aliases. */
export const ALIASES = new Map([
  ['react', 'preact/compat'],
  ['react/jsx-runtime', 'preact/jsx-runtime'],
  ['react/jsx-dev-runtime', 'preact/jsx-runtime'],
  ['react-dom', 'preact/compat'],
  ['react-dom/client', 'preact/compat'],
])

/**
 * Resolve a specifier, substituting the Preact alias when it names React.
 *
 * @param specifier The bare specifier or path being resolved.
 * @param context The resolution context (parent URL, conditions).
 * @param nextResolve The next resolver in the chain.
 * @returns The resolution result for the aliased specifier.
 */
export async function resolve(specifier, context, nextResolve) {
  const alias = ALIASES.get(specifier)
  if (alias === undefined) return nextResolve(specifier, context)
  return nextResolve(alias, context)
}
