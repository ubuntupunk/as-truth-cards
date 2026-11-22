/**
 * Regression test for theme-responsive shared buttons (bug reported 2026-11-22).
 *
 * Toggling light/dark visibly repainted the primary actions on Graph and
 * Research because those controls use `bg-graph-accent`, a token remapped for
 * every treatment in both modes. The shared `Button` default variant instead
 * used `bg-primary`: in `index.css` that token is a near-white surface in both
 * modes (95.9% and 98% lightness), so its buttons looked unchanged everywhere
 * else. A shared button's fill must come from a token that actually changes
 * with the theme — either through distinct light/dark values or through the
 * treatment zone's light/dark mapping.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/** Read a repository file relative to this test. */
function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

/** Extract one CSS rule body by its exact selector. */
function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(
    new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`),
  )
  assert.ok(match, `expected a CSS rule for ${selector}`)
  return match[2]
}

/** Read a custom property's value from a rule body. */
function tokenValue(block: string, token: string): string | null {
  return (
    block.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))?.[1]?.trim() ?? null
  )
}

/** Parse an HSL triplet such as `262 83.3% 57.8%` into numbers. */
function hsl(value: string): [number, number, number] {
  const match = value.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
  assert.ok(match, `expected an HSL triplet, got ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Whether a fill token is repainted for the active theme/treatment. */
function isThemeResponsive(css: string, token: string): boolean {
  const light = tokenValue(cssBlock(css, ':root'), token)
  const dark = tokenValue(cssBlock(css, '.dark'), token)
  assert.ok(light, `${token} needs a light value in :root`)
  assert.ok(dark, `${token} needs a dark value in .dark`)

  // Treatment zones remap their own light/dark pairs on the same element, so a
  // token present in both zone rules is theme-responsive by construction.
  const remapped =
    tokenValue(cssBlock(css, '[data-treatment]'), token) !== null &&
    tokenValue(cssBlock(css, '.dark [data-treatment]'), token) !== null
  if (remapped) return true

  // Otherwise the two raw values must differ visibly: a near-white surface
  // changing from 95.9% to 98% lightness is not a theme change users can see.
  const [h1, s1, l1] = hsl(light)
  const [h2, s2, l2] = hsl(dark)
  return (
    Math.abs(h1 - h2) >= 30 ||
    Math.abs(s1 - s2) >= 20 ||
    Math.abs(l1 - l2) >= 10
  )
}

describe('shared buttons follow the same theme as graph actions', () => {
  it('fills the default Button with a token that visibly changes in dark mode', () => {
    const button = repoFile('src/components/ui/button.tsx')
    const css = repoFile('src/index.css')
    const variant = button.match(/default:\s*'([^']+)'/)?.[1]
    assert.ok(variant, 'the Button default variant must be readable')

    const fillToken = variant.match(/\bbg-([a-z0-9-]+)/)?.[1]
    assert.ok(fillToken, 'the default Button must have a solid fill class')
    const token = `--${fillToken}`

    assert.equal(
      isThemeResponsive(css, token),
      true,
      `${token} keeps shared buttons the same colour in light and dark mode, ` +
        'while Graph and Research buttons repaint — the shared Button must use ' +
        'a theme-responsive accent token',
    )
  })
})
