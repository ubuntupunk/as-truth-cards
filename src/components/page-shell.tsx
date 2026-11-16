/**
 * The shared page shell: surface, header, main, footer, and the one heading
 * pattern every routed page uses.
 *
 * Geometry lives in `lib/page-layout.ts` so the header and footer — which are
 * rendered inside this shell but also imported standalone by tests — can align
 * to the same container constants without an import cycle. This module adds
 * the composition and the heading/breadcrumb typography.
 *
 * Why a shell at all: before bd `as-truth-cards-5ff` each page rebuilt
 * `<div class="flex min-h-screen flex-col"><Header/><main/><Footer/></div>`
 * with its own width and padding, so routes disagreed about the page edge. A
 * page now picks *content* (what goes inside `PageMain`), never geometry.
 */

import type { ComponentChildren, JSX } from 'preact'
import {
  PAGE_GUTTER_CLASS,
  PAGE_MAIN_CLASS,
  PAGE_SURFACE_CLASS,
  PAGE_WIDTH_CLASS,
} from '@/lib/page-layout'
import { cn } from '@/lib/utils'
import Footer from './Footer'
import Header from './Header'

/**
 * The routed page frame: slate surface, global header, the caller's main, then
 * the global footer.
 *
 * @param props.children The page body — normally a {@link PageMain}.
 * @param props.className Extra wrapper classes (e.g. a deck treatment marker).
 * @param props.style Inline custom properties for the graph chrome treatments.
 * @param props.treatment When set, marks the wrapper with `data-treatment` so
 *   treatment-scoped selectors and tests see which chrome is active.
 * @returns The full-height page frame.
 */
export function PageShell({
  children,
  className,
  style,
  treatment,
}: {
  children: ComponentChildren
  className?: string
  style?: JSX.CSSProperties
  treatment?: string
}) {
  return (
    <div
      className={cn(PAGE_SURFACE_CLASS, className)}
      style={style}
      data-treatment={treatment}
    >
      <Header />
      {children}
      <Footer />
    </div>
  )
}

/**
 * The page's `<main>`.
 *
 * The gutters are applied here, at the viewport edge, and the container is the
 * single centred `max-w-7xl` box inside them — the same split the header and
 * footer use, so every content edge lines up. Pass `innerClassName` to alter
 * the content flow (e.g. a grid); pass `className` only for exceptional cases
 * such as the 404's centring.
 *
 * @param props.children Page content.
 * @param props.className Classes for the `<main>` itself.
 * @param props.innerClassName Classes for the inner container.
 * @param props.innerStyle Inline styles for the inner container (e.g. the graph
 *   treatment's font family on the deck and onboarding surfaces).
 * @param props.testId Optional `data-testid` for tests that assert the region.
 * @returns The main content region.
 */
export function PageMain({
  children,
  className,
  innerClassName,
  innerStyle,
  testId,
}: {
  children: ComponentChildren
  className?: string
  innerClassName?: string
  innerStyle?: JSX.CSSProperties
  testId?: string
}) {
  return (
    <main
      data-testid={testId}
      className={cn(PAGE_MAIN_CLASS, PAGE_GUTTER_CLASS, className)}
    >
      <div className={cn(PAGE_WIDTH_CLASS, innerClassName)} style={innerStyle}>
        {children}
      </div>
    </main>
  )
}

/**
 * The research breadcrumb shown above a page heading.
 *
 * One separator (`·`) and one label set across every surface; the Graph shell
 * previously drew an SVG slash while Deck/Explore/Compose used a middot, which
 * is the kind of drift this component exists to end.
 *
 * @param props.contextLabel The last segment (the current page).
 * @param props.testId Optional `data-testid`.
 * @returns The breadcrumb navigation.
 */
export function PageBreadcrumb({
  contextLabel,
  testId,
}: {
  contextLabel: string
  testId?: string
}) {
  return (
    <nav
      data-testid={testId}
      aria-label="Breadcrumb"
      className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span>Trope Cards</span>
      <span aria-hidden="true">·</span>
      <span>Research</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium text-foreground">{contextLabel}</span>
    </nav>
  )
}

/**
 * The page heading: uppercase eyebrow, one `h1` scale, one description scale.
 *
 * Page titles used to disagree — `text-3xl` here, `text-3xl sm:text-4xl` on the
 * account surfaces, `font-bold` in Admin — so the title visibly changed size on
 * navigation. `actions` is for the heading-row controls the Deck and Graph
 * surfaces put on the right.
 *
 * @param props.eyebrow Small uppercase kicker, e.g. `Research / Explore`.
 * @param props.title The page `h1`.
 * @param props.description One-line description under the title.
 * @param props.actions Optional controls aligned to the baseline on the right.
 * @param props.testId Optional `data-testid`.
 * @returns The heading block.
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  testId,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ComponentChildren
  testId?: string
}) {
  return (
    <header
      data-testid={testId}
      className={cn(
        'mt-4',
        actions === undefined
          ? undefined
          : 'flex items-end justify-between gap-4',
      )}
    >
      <div>
        {eyebrow === undefined ? null : (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions === undefined ? null : <div>{actions}</div>}
    </header>
  )
}
