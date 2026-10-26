/**
 * Shared HTTP plumbing for discovery provider adapters.
 *
 * Every adapter owes the provider the same four things: one bounded request per call, a client
 * that identifies itself, spacing so a burst cannot hammer the provider, and a failure that says
 * *what kind* of failure it was so the caller can decide whether to retry. Keeping that here
 * means an adapter file contains only what is genuinely about its provider — the URL it calls and
 * the mapping from the provider's payload to {@link DiscoveredRecord}s — and two adapters cannot
 * drift apart on timeout, throttle, abort, or status handling.
 *
 * The client is deliberately shallow: it returns decoded JSON and nothing else. It does not know
 * what a record is, so it cannot leak provider payload into the candidate store, and it offers no
 * way to retain a response body (retention is unavailable until the report §5 review resolves —
 * see `docs/issue-12-plumx-research-report.md`).
 */

import {
  DiscoveryProviderError,
  type DiscoveryProviderErrorKind,
} from '../types'

/**
 * The minimal `fetch` shape the adapters use, declared structurally so a test can inject a mock
 * without importing the DOM lib and so an adapter does not depend on a global `fetch` type being
 * present in every compilation unit.
 */
export type FetchResponseLike = {
  readonly ok: boolean
  readonly status: number
  readonly statusText?: string
  json(): Promise<unknown>
}

/** A `fetch`-compatible function. Matches the global `fetch` and accepts a mock. */
export type FetchLike = (
  url: string,
  init: {
    readonly headers: Record<string, string>
    readonly signal: AbortSignal
  },
) => Promise<FetchResponseLike>

/** Identifies one provider to the client so failures carry the right `provider` and wording. */
export type RequestIdentity = {
  /** Stable lower-case provider key, stored on every candidate and set on the thrown error. */
  readonly provider: string
  /** Human-facing provider name used in error messages (e.g. `Crossref`). */
  readonly label: string
  /** Optional caller cancellation signal, forwarded to the request. */
  readonly signal?: AbortSignal
}

/** A ready-to-use polite JSON client. */
export type JsonClient = {
  /**
   * Issue one request and decode its JSON body.
   *
   * @param url The fully-built request URL.
   * @param identity The provider key (for the error), a human label (for messages), and an
   *   optional caller signal.
   * @returns The decoded JSON payload, exactly as the provider sent it.
   * @throws {DiscoveryProviderError} On transport, HTTP, timeout, abort, or JSON-decode failure.
   */
  readonly get: (url: string, identity: RequestIdentity) => Promise<unknown>
}

/** Transport tuning shared by the adapters. Every field has a safe default. */
export type JsonClientOptions = {
  /** Injected HTTP client. Defaults to the global `fetch`. */
  readonly fetch?: FetchLike
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  readonly timeoutMs?: number
  /**
   * Minimum spacing between requests, in milliseconds, enforced across calls on this client so a
   * burst of discovery requests cannot hammer the provider. Defaults to 1000; tests pass `0`.
   */
  readonly minIntervalMs?: number
  /** `User-Agent` product token. Defaults to `as-truth-cards/0.0`. */
  readonly userAgent?: string
  /**
   * Contact address advertised in the `User-Agent`. `null` when the deployment has none, in which
   * case requests still work but are not eligible for the provider's polite pool.
   */
  readonly mailto?: string | null
  /** `Accept` header. Defaults to `application/json`. */
  readonly accept?: string
}

/**
 * Build a polite JSON client: one request at a time, spaced by `minIntervalMs`, bounded by
 * `timeoutMs`, cancellable by the caller, with failures classified by
 * {@link DiscoveryProviderErrorKind}.
 *
 * @param options Transport tuning; every field has a safe default.
 * @returns A {@link JsonClient} whose throttle state is shared across its calls.
 */
export function createJsonClient(options: JsonClientOptions = {}): JsonClient {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = options.timeoutMs ?? 8000
  const minIntervalMs = options.minIntervalMs ?? 1000
  const accept = options.accept ?? 'application/json'
  const userAgent = options.userAgent ?? 'as-truth-cards/0.0'
  const mailto = options.mailto?.trim() || null
  const userAgentHeader = mailto ? `${userAgent} (mailto:${mailto})` : userAgent

  let nextAllowedAt = 0
  let gate: Promise<void> = Promise.resolve()

  const waitForSlot = async (): Promise<void> => {
    if (minIntervalMs <= 0) return
    const run = gate.then(async () => {
      const wait = nextAllowedAt - Date.now()
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
      nextAllowedAt = Date.now() + minIntervalMs
    })
    gate = run.catch(() => undefined)
    await run
  }

  return {
    async get(url, { provider, label, signal }): Promise<unknown> {
      await waitForSlot()

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const onExternalAbort = (): void => controller.abort()
      signal?.addEventListener('abort', onExternalAbort, { once: true })

      const headers: Record<string, string> = {
        Accept: accept,
        'User-Agent': userAgentHeader,
      }

      let response: FetchResponseLike
      try {
        response = await doFetch(url, { headers, signal: controller.signal })
      } catch (error) {
        if (controller.signal.aborted) {
          const kind: DiscoveryProviderErrorKind = signal?.aborted
            ? 'aborted'
            : 'timeout'
          throw new DiscoveryProviderError(
            provider,
            kind,
            kind === 'timeout'
              ? `${label} request timed out after ${timeoutMs}ms`
              : `${label} request was aborted`,
          )
        }
        const reason = error instanceof Error ? error.message : String(error)
        throw new DiscoveryProviderError(
          provider,
          'http',
          `${label} request failed: ${reason}`,
        )
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onExternalAbort)
      }

      if (!response.ok) {
        throw new DiscoveryProviderError(
          provider,
          'http',
          `${label} responded with HTTP ${response.status}`,
          response.status,
        )
      }

      try {
        return await response.json()
      } catch {
        throw new DiscoveryProviderError(
          provider,
          'malformed',
          `${label} returned a body that is not valid JSON`,
        )
      }
    },
  }
}
