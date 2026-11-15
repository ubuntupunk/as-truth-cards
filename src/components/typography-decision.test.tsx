/**
 * Guards for the typography decision (issue `06o`, 2026-11-15).
 *
 * The improved Figma panels set body copy in Inter and display text in Lora, but
 * the shipped product loads no webfont at all — it renders in the reader's own
 * UI font. The decision was to keep it that way, and a decision only holds if
 * nothing quietly reintroduces a remote font: a Google Fonts `<link>`, an
 * `@font-face` block, or a webfont package is exactly how that would happen.
 *
 * SPEC §4.2 is the authority; these assertions keep the code and the record from
 * drifting apart.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/** Read a repository file relative to this test. */
function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

/** Fonts the product deliberately does not load. */
const REFERENCE_ONLY_FONTS = ['Inter', 'Lora']

describe('typography decision (06o)', () => {
  it('loads no remote font from the HTML shell', () => {
    const html = repoFile('index.html')
    assert.equal(html.includes('fonts.googleapis.com'), false)
    assert.equal(html.includes('fonts.gstatic.com'), false)
    assert.equal(html.includes('webfont'), false)
  })

  it('declares no @font-face in the stylesheet', () => {
    assert.equal(repoFile('src/index.css').includes('@font-face'), false)
  })

  it('depends on no webfont package', () => {
    const manifest = JSON.parse(repoFile('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const names = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    })
    const webfontPackages = names.filter(
      (name) =>
        name.startsWith('@fontsource/') ||
        name.includes('webfont') ||
        name.includes('font-face'),
    )
    assert.deepEqual(webfontPackages, [])
  })

  it('keeps the system stack as the sans family', () => {
    const config = repoFile('tailwind.config.ts')
    // The first family in `sans` must be a system face, not a downloaded one.
    const sans = config.match(/sans:\s*\[([^\]]*)\]/)?.[1] ?? ''
    for (const reference of REFERENCE_ONLY_FONTS) {
      assert.equal(
        sans.includes(`'${reference}`),
        false,
        `${reference} is a Figma annotation, not a shipped font`,
      )
    }
    assert.ok(
      sans.includes('system-ui') || sans.includes('SF Pro'),
      `sans should lead with a system face, found: ${sans}`,
    )
  })

  it('records the decision in SPEC §4.2', () => {
    const spec = repoFile('SPEC.md')
    const section = spec.slice(spec.indexOf('### 4.2 Typography'))
    const body = section.slice(0, section.indexOf('### 4.3'))
    assert.match(body, /keep the system stack/i)
    assert.match(body, /06o/)
  })
})
