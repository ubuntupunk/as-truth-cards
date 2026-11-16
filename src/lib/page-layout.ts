/**
 * The one page geometry every route shares (bd `as-truth-cards-5ff`).
 *
 * Before this module the app had three page systems: Deck/Graph/Research/
 * Sources/Account on `bg-graph-page` at `max-w-7xl`, Explore/Compose on plain
 * white at `max-w-5xl`, and reading/auth pages on white at `max-w-3xl`/`md`.
 * Header and footer used Tailwind's `container`, which also *snaps* its width at
 * 640/768/1024/1280/1400px and adds 2rem of its own padding on top of the
 * shell's. The result was a page that changed width between routes and jumped
 * at breakpoints — and a header whose content edge never lined up with the
 * page's.
 *
 * These constants are the contract instead:
 *
 * - **Surface**: the slate `graph-page` background, everywhere. It is the
 *   figure/ground the graph chrome and the account shell were designed on, so
 *   it is the theme rather than one page's decoration.
 * - **Width**: one container, `max-w-7xl`, on every route. Reading surfaces cap
 *   their prose *inside* it; they never change the container itself, so the
 *   page edge stays put when you navigate.
 * - **Gutters**: `px-4 → sm:px-6 → lg:px-8`, applied at the viewport edge and
 *   never inside the container. Both halves matter: padding inside the
 *   `max-w-7xl` box would make the header 64px narrower than the page, which is
 *   the misalignment this replaces.
 * - **Vertical rhythm**: `pt-24` clears the fixed header, `pb-16` is the shared
 *   footer gap.
 *
 * `container` (the Tailwind utility) must not be used for page geometry: its
 * breakpoint snapping is the "sudden jump in size".
 */

/**
 * Page wrapper: full height, column flow so the footer stays at the bottom.
 *
 * The surface is `bg-muted`, not the literal `bg-graph-page` class. The two are
 * the same colour in light mode — both resolve to `220 14.3% 95.9%` — but
 * `bg-graph-page` reads `--graph-page`, which the graph treatments redefine as
 * a light-only literal and which `.dark` never overrides. On a dark-preferring
 * system that produced near-white text on a light slate page. `--muted` and
 * `--foreground` move together per theme, so "graph chrome everywhere" now
 * holds in dark mode too.
 */
export const PAGE_SURFACE_CLASS =
  'flex min-h-screen flex-col bg-muted text-foreground'

/** Horizontal gutters, applied at the viewport edge (header, main, footer). */
export const PAGE_GUTTER_CLASS = 'px-4 sm:px-6 lg:px-8'

/** The single content container. Apply *inside* {@link PAGE_GUTTER_CLASS}. */
export const PAGE_WIDTH_CLASS = 'mx-auto w-full max-w-7xl'

/** The shared main offsets: clears the fixed header, leaves the footer gap. */
export const PAGE_MAIN_CLASS = 'flex-grow pb-16 pt-24'
