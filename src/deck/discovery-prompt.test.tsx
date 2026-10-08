/**
 * Tests for `discovery-prompt.tsx` — SPEC §6.4.
 *
 * The rule this component exists to keep is "no manufactured conclusion":
 * the prompt and its four lenses must be questions, offered in the words the
 * spec names (language, place, collective memory, concepts), with nothing
 * asserted about what the card shows.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { DISCOVERY_LENSES, discoveryPrompt } from './deck-model'
import { DiscoveryPrompt } from './discovery-prompt'
import { ESTABLISHED_CARD, OPEN_CARD, walk } from './test-fixtures'

/**
 * The rendered question text of each lens card, in document order.
 *
 * @param model The prompt model under test.
 * @returns One string per lens: its final paragraph.
 */
function lensQuestions(model: ReturnType<typeof discoveryPrompt>): string[] {
  const lenses = walk(DiscoveryPrompt({ model }), (node) => {
    const value = node.props?.['data-lens']
    return value !== undefined && value !== null
  })
  return lenses.map((lens) => {
    const children = (lens.props?.children ?? []) as VNode[]
    const paragraph = children.at(-1) as VNode
    return String(paragraph.props?.children ?? '')
  })
}

describe('DiscoveryPrompt', () => {
  it('renders the model’s question and all four lenses', () => {
    const model = discoveryPrompt(OPEN_CARD)
    const html = render(<DiscoveryPrompt model={model} />)
    assert.ok(html.includes('data-testid="discovery-prompt"'))
    assert.ok(html.includes('Was the figure inflated?'))
    assert.deepEqual(
      walk(DiscoveryPrompt({ model }), (node) => {
        const value = node.props?.['data-lens']
        return value !== undefined && value !== null
      }).map((lens) => lens.props?.['data-lens']),
      ['language', 'place', 'collective memory', 'concepts'],
    )
  })

  it('renders every lens as a question, never as a conclusion', () => {
    const questions = lensQuestions(discoveryPrompt(ESTABLISHED_CARD))
    assert.equal(questions.length, 4)
    for (const question of questions) {
      assert.ok(question.length > 0, 'lens question rendered')
      assert.ok(question.endsWith('?'), question)
    }
  })

  it('offers the lens set from the model, not a locally invented one', () => {
    const model = discoveryPrompt(OPEN_CARD)
    assert.equal(model.lenses, DISCOVERY_LENSES)
    const html = render(<DiscoveryPrompt model={model} />)
    for (const lens of DISCOVERY_LENSES) {
      assert.ok(html.includes(`data-lens="${lens.label}"`))
      assert.ok(html.includes(lens.question))
    }
  })

  it('keeps the lens heading an invitation rather than a verdict', () => {
    const html = render(<DiscoveryPrompt model={discoveryPrompt(OPEN_CARD)} />)
    assert.ok(html.includes('Look again through another lens'))
    assert.ok(!html.includes('This card shows'))
    assert.ok(!html.includes('Conclusion'))
  })
})
