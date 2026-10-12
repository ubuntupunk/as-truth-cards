/**
 * A Preact error boundary for a route subtree.
 *
 * Preact only catches render-phase throws in *class* components, so this is the
 * one class component in `src/components`. It is deliberately small: all it does
 * is turn a thrown value into state ({@link getDerivedStateFromError}), record
 * the failure ({@link componentDidCatch}), and render {@link RouteErrorFallback}
 * in place of the crashed children. The presentational work lives in that pure
 * component, which keeps the boundary itself free of layout and Node-testable.
 *
 * Why a route boundary and not one at the app root: a crash in one view should
 * cost the user that view, not the whole application. `App` wraps each entry of
 * `APP_ROUTES` in its own boundary (see `route-boundary.tsx`), so the fallback's
 * label names exactly which route failed and the rest of the app is unaffected.
 *
 * Live catching (the browser-only behaviour — a child throwing and the fallback
 * appearing) cannot be exercised by the DOM-less `preact-render-to-string`
 * harness. Its two halves are: the pure state derivation and render are unit
 * tested, and the end-to-end catch is intentionally left to the browser, the
 * same split `drawer-a11y.ts` uses for DOM-dependent behaviour.
 */

import { Component, type ComponentChildren } from 'preact'
import { RouteErrorFallback } from './route-error-fallback'

/** Props for {@link ErrorBoundary}. */
export interface ErrorBoundaryProps {
  /** The subtree to guard. */
  children?: ComponentChildren
  /** The route path (or other name) shown in the fallback and log line. */
  label?: string
  /**
   * Render a custom fallback instead of {@link RouteErrorFallback}. Receives the
   * captured error and a `reset` callback that re-renders the children.
   */
  fallback?: (error: Error, reset: () => void) => ComponentChildren
}

/** State for {@link ErrorBoundary}. */
export interface ErrorBoundaryState {
  /** The captured error, or `null` while the children are rendering cleanly. */
  error: Error | null
}

/**
 * Normalise any thrown value to an `Error` so the fallback always has a
 * `.message` and the log line is never `[object Object]`.
 */
function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown))
}

/** Guards a subtree against render-phase throws. See file header. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  /**
   * Derive the next state from a thrown value. Pure and static so Preact can
   * call it during the failed render; also unit-tested directly.
   *
   * @param thrown The value a descendant threw.
   * @returns The state that switches the boundary into its fallback.
   */
  static getDerivedStateFromError(thrown: unknown): ErrorBoundaryState {
    return { error: toError(thrown) }
  }

  /**
   * Record the failure. Preact calls this after the fallback has been chosen;
   * the log line carries the label so a console error names its route.
   *
   * @param error The captured error.
   * @param errorInfo Preact's extra context (component stack).
   */
  componentDidCatch(error: Error, errorInfo: unknown): void {
    const where = this.props.label ? ` on “${this.props.label}”` : ''
    console.error(`[ErrorBoundary] render error${where}`, error, errorInfo)
  }

  /** Clear the captured error so the children render again. */
  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ComponentChildren {
    const { error } = this.state
    if (error !== null) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset)
      }
      return (
        <RouteErrorFallback
          error={error}
          onRetry={this.reset}
          label={this.props.label}
        />
      )
    }
    return this.props.children
  }
}
