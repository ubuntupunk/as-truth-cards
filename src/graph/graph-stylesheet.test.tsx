/**
 * Tests for `graph-stylesheet.ts` — the Cytoscape stylesheet.
 *
 * The interesting contract is not the colours (those are taste) but the
 * *shape* of the rules: every adapter-emitted class namespaced by type /
 * family / status-source has exactly one rule, the presentation-state rules
 * come last so they win the cascade, and — pinned by a specific test — there
 * is deliberately no `.relation-*` rule. Colouring the relation vocabulary
 * would mean enumerating five distinct vocabularies inside a stylesheet,
 * which is precisely the hard-coded ontology the plan forbids.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  EdgeFamily,
  GraphNodeType,
} from '../../trope-cards/src/graph/types.ts'
import {
  EDGE_FAMILY_COLORS,
  GRAPH_STYLESHEET,
  NODE_TYPE_COLORS,
  STATUS_BORDER_STYLES,
} from './graph-stylesheet'

/** The sorted selector list the sheet actually emits. */
function selectors(): string[] {
  return GRAPH_STYLESHEET.map((rule) => rule.selector)
}

/** A rule's style bag, untyped so tests can read any visual property. */
function styleOf(selector: string): Record<string, unknown> {
  const rule = GRAPH_STYLESHEET.find((entry) => entry.selector === selector)
  assert.ok(rule, `no rule for selector ${selector}`)
  const bag = 'style' in rule ? rule.style : 'css' in rule ? rule.css : {}
  return bag as unknown as Record<string, unknown>
}

describe('GRAPH_STYLESHEET structure', () => {
  it('emits exactly one rule per node type selector', () => {
    const list = selectors()
    const types = Object.keys(NODE_TYPE_COLORS) as GraphNodeType[]
    assert.equal(types.length, 12, 'the domain should have twelve node types')
    for (const type of types) {
      const hits = list.filter((selector) => selector === `.type-${type}`)
      assert.equal(
        hits.length,
        1,
        `expected exactly one .type-${type} rule, found ${hits.length}`,
      )
    }
  })

  it('emits exactly one rule per edge family selector', () => {
    const list = selectors()
    const families = Object.keys(EDGE_FAMILY_COLORS) as EdgeFamily[]
    assert.equal(
      families.length,
      7,
      'the domain should have seven edge families: five original plus source and evidence',
    )
    for (const family of families) {
      const hits = list.filter((selector) => selector === `.family-${family}`)
      assert.equal(
        hits.length,
        1,
        `expected exactly one .family-${family} rule, found ${hits.length}`,
      )
    }
  })

  it('emits one border rule per status source', () => {
    const list = selectors()
    const sources = Object.keys(STATUS_BORDER_STYLES)
    assert.equal(sources.length, 5, 'there are five NodeStatus source variants')
    for (const source of sources) {
      assert.ok(list.includes(`.status-${source}`), `missing .status-${source}`)
    }
  })

  it('keeps the presentation-state rules last so they win the cascade', () => {
    const list = selectors()
    assert.equal(list[list.length - 1], '.selected')
    assert.ok(list.indexOf('.is-focus') > list.indexOf('node'))
    assert.ok(list.indexOf('.selected') > list.indexOf('.is-focus'))
  })
})

describe('GRAPH_STYLESHEET base rules', () => {
  it('styles node labels with an outlined halo for readability', () => {
    const style = styleOf('node')
    assert.equal(style['text-outline-color'], '#ffffff')
    assert.equal(style['text-outline-width'], 2)
    assert.ok(style['text-max-width'])
  })

  it('draws edges with a target arrow in the authored direction', () => {
    const style = styleOf('edge')
    assert.equal(style['target-arrow-shape'], 'triangle')
    assert.equal(style['curve-style'], 'bezier')
  })
})

describe('GRAPH_STYLESHEET vocabulary rules', () => {
  it('maps card type fill and domain family line from the exported maps', () => {
    assert.equal(
      styleOf('.type-card')['background-color'],
      NODE_TYPE_COLORS.card,
    )
    assert.equal(
      styleOf('.family-domain')['line-color'],
      EDGE_FAMILY_COLORS.domain,
    )
    assert.equal(
      styleOf('.family-domain')['target-arrow-color'],
      EDGE_FAMILY_COLORS.domain,
    )
  })

  it('gives taxonomy nodes (status none) the light no-claim border', () => {
    assert.equal(styleOf('.status-none')['border-color'], '#cbd5e1')
    assert.equal(styleOf('.status-none')['border-style'], 'solid')
  })

  it('maps status sources to distinct line styles', () => {
    assert.equal(styleOf('.status-epistemic_status')['border-style'], 'solid')
    assert.equal(
      styleOf('.status-independent_inference_status')['border-style'],
      'double',
    )
    assert.equal(styleOf('.status-evidence_status')['border-style'], 'dotted')
    assert.equal(styleOf('.status-lifecycle_status')['border-style'], 'dashed')
  })

  it('PINS the absence of relation-vocabulary colouring', () => {
    const list = selectors()
    const relationRules = list.filter((selector) =>
      selector.startsWith('.relation-'),
    )
    assert.equal(
      relationRules.length,
      0,
      'relation words are rendered by name + inspector, never coloured',
    )
  })

  it('renders traversal direction separately from authored direction', () => {
    const style = styleOf('.traversal-bidirectional')
    assert.equal(style['line-style'], 'dashed')
  })
})
