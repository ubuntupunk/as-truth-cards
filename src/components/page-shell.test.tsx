/**
 * Guards for the one page shell (bd `as-truth-cards-5ff`).
 *
 * The pages used to disagree about geometry: Deck/Graph/Research/Sources/
 * Account on `bg-graph-page` at `max-w-7xl`, Explore/Compose on white at
 * `max-w-5xl`, reading pages on white at `max-w-3xl`, and Admin/LegacyDeck on
 * Tailwind's `container` — a utility that *snaps* its width at 640/768/1024/
 * 1280/1400px and adds 2rem of padding of its own. The result was a page edge
 * that moved between routes and jumped at breakpoints, with the fixed header
 * centred on a different box than the page beneath it.
 *
 * The decision is that geometry lives in `lib/page-layout.ts` and pages choose
 * only content. These assertions keep the code from drifting back: the shell
 * constants, the `container` ban, and every routed page's use of the shell.
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import {
  PAGE_GUTTER_CLASS,
  PAGE_MAIN_CLASS,
  PAGE_SURFACE_CLASS,
  PAGE_WIDTH_CLASS,
} from '@/lib/page-layout'
import { PageBreadcrumb, PageHeading, PageMain } from './page-shell'

/** Read a repository file relative to this test. */
function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

/** Every routed page module, excluding test files. */
function pageModules(): { name: string; source: string }[] {
  const dir = new URL('../../src/pages/', import.meta.url)
  return readdirSync(dir)
    .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
    .map((name) => ({ name, source: readFileSync(new URL(name, dir), 'utf8') }))
}

describe('page layout constants', () => {
  it('defines one surface, one width, one gutter scale and one vertical rhythm', () => {
    assert.equal(
      PAGE_SURFACE_CLASS.includes('flex min-h-screen flex-col'),
      true,
    )
    assert.equal(PAGE_SURFACE_CLASS.includes('bg-muted'), true)
    // `--graph-page` is a light-only literal; a page surface keyed to it broke
    // dark mode. The shell must stay on the theme-aware token.
    assert.equal(PAGE_SURFACE_CLASS.includes('bg-graph-page'), false)
    assert.equal(PAGE_WIDTH_CLASS.includes('max-w-7xl'), true)
    assert.equal(PAGE_GUTTER_CLASS, 'px-4 sm:px-6 lg:px-8')
    assert.equal(PAGE_MAIN_CLASS.includes('pt-24'), true)
    assert.equal(PAGE_MAIN_CLASS.includes('pb-16'), true)
  })
})

describe('page shell primitives', () => {
  it('renders the gutters at the viewport edge and the container inside them', () => {
    const html = render(<PageMain>[[content]]</PageMain>)
    assert.equal(html.startsWith('<main'), true)
    assert.equal(html.includes('px-4 sm:px-6 lg:px-8'), true)
    assert.equal(html.includes('pt-24'), true)
    assert.equal(html.includes('pb-16'), true)
    // The container must be a child, not the padded element itself: padding on
    // the `max-w-7xl` box would make the header 48–64px wider than the page.
    assert.equal(html.includes('<div class="mx-auto w-full max-w-7xl">'), true)
    assert.equal(html.includes('[[content]]'), true)
  })

  it('renders one heading scale whatever the page', () => {
    const html = render(
      <PageHeading
        eyebrow="Research / Explore"
        title="Explorer"
        description="One description."
      />,
    )
    assert.equal(html.includes('>Research / Explore<'), true)
    assert.equal(html.includes('>Explorer<'), true)
    assert.equal(html.includes('>One description.<'), true)
    assert.equal(html.includes('text-3xl font-semibold tracking-tight'), true)
    assert.equal(html.includes('sm:text-4xl'), false)
    assert.equal(html.includes('font-bold'), false)
  })

  it('renders the one breadcrumb separator', () => {
    const html = render(<PageBreadcrumb contextLabel="Sources" />)
    assert.equal(html.includes('>Trope Cards<'), true)
    assert.equal(html.includes('>Research<'), true)
    assert.equal(html.includes('>Sources<'), true)
    assert.equal(html.includes('>·<'), true)
    assert.equal(html.includes('<svg'), false)
  })
})

describe('every routed page uses the shell', () => {
  it('mounts PageShell and never Tailwind’s snapping container', () => {
    const pages = pageModules()
    assert.ok(pages.length > 10)
    for (const { name, source } of pages) {
      assert.equal(
        source.includes("from '@/components/page-shell'"),
        true,
        `${name} must render PageShell from components/page-shell`,
      )
      assert.equal(
        /className=(?:"[^"]*\bcontainer\b|'[^']*\bcontainer\b)/.test(source),
        false,
        `${name} must not use Tailwind's container utility`,
      )
    }
  })
})

describe('theme surface', () => {
  it('reserves the scrollbar gutter so the page edge does not shift between routes', () => {
    const css = repoFile('src/index.css')
    assert.equal(css.includes('scrollbar-gutter: stable'), true)
  })

  it('gives the graph chrome dark-mode tokens', () => {
    const css = repoFile('src/index.css')
    const dark = css.slice(css.indexOf('.dark {'))
    for (const token of [
      '--graph-page:',
      '--graph-surface:',
      '--graph-border:',
      '--graph-muted-foreground:',
    ]) {
      assert.equal(
        dark.includes(token),
        true,
        `dark mode must redefine ${token} or graph chrome goes white-on-white`,
      )
    }
  })
})
