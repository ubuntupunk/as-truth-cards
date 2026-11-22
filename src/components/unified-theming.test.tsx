/**
 * Regression tests for unified theming (bd `as-truth-cards-e4k`).
 *
 * Two independent "theme" systems had drifted. The light/dark authority was a
 * local provider, but Sonner's toasts asked `next-themes` (which is not
 * mounted), so they followed the OS rather than the user's toggle. The
 * Atmospheric / Editorial / Workspace treatment was scoped to a few pages and
 * subtrees, with four local copies of the selected value, one page pinned to
 * Atmospheric, and no cross-tab synchronisation. These tests pin the fix:
 * one light/dark utility, and one global treatment authority above every route.
 *
 * Per-treatment dark palettes from `as-truth-cards-ci8` stay intact — these
 * tests only require the choice to be applied everywhere, not flattened.
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'

/** Read a repository file relative to this test. */
function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

/**
 * Read every non-test source file under a directory, recursively.
 *
 * @param relative Directory relative to the repository root.
 * @returns Path/source pairs for static wiring assertions.
 */
function sourceFiles(relative: string): { path: string; source: string }[] {
  const root = new URL(`../../${relative}/`, import.meta.url)
  const files: { path: string; source: string }[] = []
  const walk = (dir: URL, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name, dir)
      if (entry.isDirectory()) {
        walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name)
      ) {
        files.push({
          path: `${relative}/${prefix}${entry.name}`,
          source: readFileSync(url, 'utf8'),
        })
      }
    }
  }
  walk(root, '')
  return files
}

describe('one light/dark theme utility', () => {
  it('makes the local ThemeProvider the only useTheme source', () => {
    const sonner = repoFile('src/components/ui/sonner.tsx')
    assert.match(
      sonner,
      /import\s*\{\s*useTheme\s*\}\s*from\s*['"](@\/components\/ThemeProvider|\.\.\/ThemeProvider)['"]/,
      'Sonner must read the same provider the header toggle writes',
    )
    for (const { path, source } of sourceFiles('src')) {
      assert.equal(
        /from\s*['"]next-themes['"]/.test(source),
        false,
        `${path} must not use a second theme library`,
      )
    }
  })

  it('applies the resolved theme to native widgets and follows system changes', () => {
    const provider = repoFile('src/components/ThemeProvider.tsx')
    assert.match(provider, /deviceStorage/, 'storage access must be guarded')
    assert.match(
      provider,
      /THEMES|isTheme/,
      'persisted themes must be validated',
    )
    assert.match(provider, /matchMedia/, 'system preference must be readable')
    assert.match(
      provider,
      /addEventListener\(['"]change['"]/,
      'system preference changes while the app is open must apply',
    )
    assert.match(
      provider,
      /colorScheme/,
      'resolved theme must drive native form controls and scrollbars',
    )
  })

  it('paints the stored theme before first paint and keeps one CSS authority', () => {
    const html = repoFile('index.html')
    const scriptStart = html.indexOf('<script')
    assert.ok(
      scriptStart >= 0,
      'index.html must host the pre-paint theme script',
    )
    const script = html.slice(scriptStart)
    assert.match(
      script,
      /prefers-color-scheme/,
      'system theme must be honoured early',
    )
    assert.match(
      script,
      /classList\.(add|toggle)/,
      'dark class must be applied early',
    )
    assert.ok(
      html.indexOf('prefers-color-scheme') < html.indexOf('/src/main.tsx'),
      'theme must be applied before the app module loads',
    )
    assert.equal(
      repoFile('src/App.css').includes('prefers-color-scheme'),
      false,
      'the dead duplicate dark rule must not survive as a second authority',
    )
  })
})

describe('one global appearance treatment', () => {
  it('exposes one treatment provider that applies the tokens and shares the choice', async () => {
    const { TreatmentProvider, useTreatment } = await import(
      './TreatmentProvider.tsx'
    )

    /** Minimal consumer proving the hook shares the provider's value. */
    const Probe = () => {
      const { treatment, setTreatment } = useTreatment()
      return (
        <span data-testid="probe">{`${treatment}/${typeof setTreatment}`}</span>
      )
    }

    const html = render(
      <TreatmentProvider initialTreatment="editorial">
        <Probe />
      </TreatmentProvider>,
    )
    assert.match(html, /data-treatment="editorial"/)
    assert.match(
      html,
      /--graph-page-light:40 33% 96%/,
      'the global zone must carry the same light/dark token pairs',
    )
    assert.match(
      html,
      /--graph-page-dark:30 18% 11%/,
      'the global zone must keep the per-treatment dark palette',
    )
    assert.match(html, /editorial\/function/)
  })

  it('mounts the treatment zone once above every route', () => {
    const app = repoFile('src/App.tsx')
    const providerStart = app.indexOf('<TreatmentProvider')
    const routerStart = app.indexOf('<BrowserRouter')
    assert.ok(providerStart >= 0, 'App must mount the global TreatmentProvider')
    assert.ok(
      routerStart > providerStart,
      'the treatment zone must wrap the router, not be rebuilt per page',
    )
    assert.match(
      repoFile('src/components/TreatmentProvider.tsx'),
      /addEventListener\(['"]storage['"]/,
      'selectors must stay in sync across tabs',
    )
  })

  it('removes per-page treatment zones and pinned treatments', () => {
    const pages = sourceFiles('src/pages')
    assert.ok(pages.length > 10)
    for (const { path, source } of pages) {
      assert.equal(
        /<PageShell[^>]*\b(treatment|style)\s*=/.test(source),
        false,
        `${path} must not create its own treatment zone`,
      )
      assert.equal(
        /readGraphTreatment|writeGraphTreatment|graphTreatmentVars/.test(
          source,
        ),
        false,
        `${path} must read the global treatment, not device storage`,
      )
      assert.equal(
        source.includes('SOURCES_TREATMENT'),
        false,
        `${path} must follow the user's treatment rather than pinning one`,
      )
    }
    const graphShell = repoFile('src/graph/graph-shell.tsx')
    assert.equal(
      graphShell.includes('graphTreatmentVars'),
      false,
      'GraphShell must not mount a narrower second treatment zone',
    )
    assert.equal(graphShell.includes('data-treatment='), false)
    const pageShell = repoFile('src/components/page-shell.tsx')
    assert.equal(
      /\btreatment\??\s*:/.test(pageShell),
      false,
      'PageShell must no longer accept a treatment prop',
    )
  })

  it('routes every selector through the shared authority', () => {
    const allowed = new Set([
      'src/components/TreatmentProvider.tsx',
      'src/graph/appearance.ts',
      'src/deck/deck-appearance.ts',
    ])
    for (const { path, source } of sourceFiles('src')) {
      if (allowed.has(path)) continue
      assert.equal(
        /writeGraphTreatment\s*\(/.test(source),
        false,
        `${path} must set the treatment through useTreatment()`,
      )
      assert.equal(
        /readGraphTreatment\s*\(/.test(source),
        false,
        `${path} must read the treatment through useTreatment()`,
      )
    }
    assert.match(
      repoFile('src/components/Header.tsx'),
      /useTreatment/,
      'the header account menu selector must use the shared choice',
    )
  })

  it('keeps the dark mapping scoped to the global treatment zone', () => {
    const css = repoFile('src/index.css')
    assert.notEqual(css.indexOf('[data-treatment] {'), -1)
    assert.notEqual(css.indexOf('.dark [data-treatment] {'), -1)
  })
})
