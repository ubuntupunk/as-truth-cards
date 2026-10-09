/**
 * Tests for `featured-card.tsx` and the regions it composes — SPEC §6.2,
 * §7 and §15.
 *
 * The contract is the acceptance criteria: identity/status, title, summary,
 * classification, provenance and evidence must be *separate* regions; the
 * status reaches the screen only as `OPEN · UNVERIFIED`; `Save card` is
 * disabled with its reason as visible text (no localStorage stand-in); and
 * `Read front & back` expands three lists that never merge sources into
 * claims or evidence.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { CardPreview, CardReading } from './deck-model'
import { deriveCardPreview, deriveCardReading } from './deck-model'
import { FeaturedCard, type FeaturedCardProps } from './featured-card'
import {
  buttonByText,
  buttons,
  CARD_VIEW,
  DECK_PROJECTION,
  ESTABLISHED_CARD,
  FEATURED_CARD_ID,
  OPEN_CARD,
  SHALLOW_PROJECTION,
  walk,
} from './test-fixtures'

/** The projection-derived models the page would hand down, once loaded. */
const PREVIEW: CardPreview = deriveCardPreview(DECK_PROJECTION, CARD_VIEW, {
  cardId: FEATURED_CARD_ID,
})
const READING: CardReading = deriveCardReading(
  DECK_PROJECTION,
  FEATURED_CARD_ID,
)

/** The featured card wired to the open, unverified fixture card. */
function fixture(overrides: Partial<FeaturedCardProps> = {}): {
  props: FeaturedCardProps
  state: { toggles: number }
} {
  const state = { toggles: 0 }
  const props: FeaturedCardProps = {
    card: OPEN_CARD,
    idLabel: 'Card / ID-07',
    preview: PREVIEW,
    reading: READING,
    readingOpen: false,
    onToggleRead: () => {
      state.toggles += 1
    },
    ...overrides,
  }
  return { props, state }
}

describe('FeaturedCard', () => {
  it('keeps title, summary, classification, provenance and evidence apart', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    for (const testid of [
      'featured-card',
      'card-metadata',
      'classification-tags',
      'provenance-preview',
      'evidence-state',
      'card-actions',
    ])
      assert.ok(html.includes(`data-testid="${testid}"`), testid)
    assert.ok(!html.includes('data-testid="card-reading"'))
  })

  it('shows the composed id label and the spec’s status badge', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(html.includes('data-testid="card-id-label"'))
    assert.ok(html.includes('Card / ID-07'))
    assert.match(html, /data-testid="card-status-badge"[^>]*data-status="OPEN"/)
    assert.ok(html.includes('OPEN · UNVERIFIED'))
    assert.ok(html.includes('data-unverified="true"'))
  })

  it('never shows the raw enum as badge text', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(!html.includes('>OPEN<'))
    assert.ok(!html.includes('epistemic_status'))
  })

  it('says the established card is established, with no amber', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          card: ESTABLISHED_CARD,
          idLabel: 'Card / ID-02',
        }).props}
      />,
    )
    assert.ok(html.includes('ESTABLISHED'))
    assert.ok(!html.includes('data-unverified'))
  })

  it('renders the title and the summary in their own regions', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(html.includes('<h2'))
    assert.ok(html.includes(OPEN_CARD.title as string))
    assert.ok(html.includes(OPEN_CARD.summary as string))
  })

  it('falls back to an honest line when neither summary nor question exists', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          card: ESTABLISHED_CARD,
          idLabel: 'Card / ID-02',
        }).props}
      />,
    )
    assert.ok(html.includes('No summary recorded for this card.'))
  })

  it('prefixes every classification chip with its dimension', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    const dimensions = walk(
      FeaturedCard(fixture().props),
      (vnode) => vnode.props?.['data-dimension'] !== undefined,
    ).map((vnode) => String(vnode.props?.['data-dimension']))
    assert.deepEqual(dimensions, [
      'Axis',
      'Axis',
      'Suit',
      'Suit',
      'Mechanism',
      'Locale',
    ])
    assert.ok(html.includes('Axis'))
    assert.ok(html.includes('Suit'))
    assert.ok(html.includes('Mechanism'))
    assert.ok(html.includes('Locale'))
  })

  it('keeps the south-africa Suit and the south-africa Locale distinct', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.match(
      html,
      /data-dimension="Suit"[^>]*>[^<]*<span[^>]*>Suit<\/span>[\s\S]*?South Africa/,
    )
    assert.match(
      html,
      /data-dimension="Locale"[^>]*>[^<]*<span[^>]*>Locale<\/span>[\s\S]*?South Africa/,
    )
    assert.equal((html.match(/·/g) ?? []).length >= 6, true)
  })

  it('reports claims, steps and this card\u2019s sources as counts', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(html.includes('2 claims'))
    assert.ok(html.includes('2 steps'))
    assert.ok(html.includes('1 source'))
    assert.ok(!html.includes('0 sources'))
  })

  it('reports the view\u2019s reason for evidence instead of a fabricated zero', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(html.includes('data-testid="evidence-state"'))
    assert.ok(
      html.includes(
        'No evidence is recorded in the corpus at all, so none is recorded against this claim — or any claim.',
      ),
    )
    assert.ok(!html.includes('0 evidence'))
  })

  it('says the dimensions sit deeper over a depth-1 projection, never zero', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          preview: deriveCardPreview(SHALLOW_PROJECTION, CARD_VIEW, {
            cardId: FEATURED_CARD_ID,
          }),
          reading: deriveCardReading(SHALLOW_PROJECTION, FEATURED_CARD_ID),
        }).props}
      />,
    )
    assert.ok(html.includes('depth 1'))
    assert.ok(!html.includes('0 steps'))
    assert.ok(!html.includes('0 sources'))
  })

  it('shows dashes and a loading caption while the projection is in flight', () => {
    const html = render(
      <FeaturedCard {...fixture({ preview: null, reading: null }).props} />,
    )
    assert.ok(html.includes('Loading card details…'))
    assert.ok(html.includes('—'))
    assert.ok(!html.includes('0 claims'))
    assert.ok(!html.includes('0 sources'))
  })

  it('says the view is still loading once the card details are there', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          preview: deriveCardPreview(SHALLOW_PROJECTION, null, {
            cardId: FEATURED_CARD_ID,
          }),
        }).props}
      />,
    )
    assert.ok(html.includes('Loading view details…'))
    assert.ok(html.includes('1 claim'))
    assert.ok(!html.includes('0 steps'))
    assert.ok(!html.includes('0 sources'))
  })

  it('offers Read front & back with aria-expanded false when closed', () => {
    const { props, state } = fixture()
    const html = render(<FeaturedCard {...props} />)
    const read = buttonByText(FeaturedCard(props), 'Read front & back')
    assert.ok(read)
    assert.equal(read?.props?.['aria-expanded'], false)
    assert.ok(html.includes('aria-expanded="false"'))
    ;(read?.props?.onClick as () => void)()
    assert.equal(state.toggles, 1)
  })

  it('keeps Save card disabled with the account-layer reason as visible text', () => {
    const { props } = fixture()
    const tree = FeaturedCard(props)
    const html = render(tree)
    const save = buttonByText(tree, 'Save card')
    assert.equal(save?.props?.disabled, true)
    assert.ok(html.includes('aria-describedby="save-card-note"'))
    assert.ok(
      html.includes(
        'Saving cards will be available when account participation is enabled.',
      ),
    )
    assert.equal(buttons(tree).filter((b) => b.props?.disabled).length, 1)
  })

  it('expands the reading into the three lists, kept separate', () => {
    const html = render(
      <FeaturedCard {...fixture({ readingOpen: true }).props} />,
    )
    assert.ok(html.includes('data-testid="card-reading"'))
    assert.ok(html.includes('Front · Claims'))
    assert.ok(html.includes('Back · Reasoning steps'))
    assert.ok(html.includes('aria-label="Sources"'))
    assert.ok(html.includes('Jesus was born in Bethlehem'))
    assert.ok(html.includes('Bridges the two claims.'))
    assert.ok(html.includes('A. Author, A primary source (A Press, 2026).'))
  })

  it('says in words that a source is neither evidence nor a claim', () => {
    const html = render(
      <FeaturedCard {...fixture({ readingOpen: true }).props} />,
    )
    assert.ok(
      html.includes(
        'Sources document where a claim came from; they are not evidence and',
      ),
    )
  })

  it('reads a claim status through the presentation mapping only', () => {
    const html = render(
      <FeaturedCard {...fixture({ readingOpen: true }).props} />,
    )
    assert.ok(html.includes('data-claim-status="ESTABLISHED"'))
    assert.ok(!html.includes('data-claim-status="OPEN"'))
  })

  it('replaces the derived regions with one error state when the projection fails', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          readingOpen: true,
          reading: null,
          preview: null,
          projectionError: new Error('projection rejected'),
        }).props}
      />,
    )
    // One display for one failure: no inline preview, no open reading, and no
    // read control that would expand into nothing.
    assert.ok(!html.includes('data-testid="provenance-preview"'))
    assert.ok(!html.includes('data-testid="evidence-state"'))
    assert.ok(!html.includes('data-testid="card-reading"'))
    assert.ok(!html.includes('Loading reading…'))
    assert.ok(html.includes('projection rejected'))
    // The listing-served half of the card is still there to read.
    assert.ok(html.includes(OPEN_CARD.title as string))
    const read = buttonByText(
      FeaturedCard(fixture().props),
      'Read front & back',
    )
    assert.ok(read)
  })

  it('omits the read control entirely when there is no projection to open', () => {
    const tree = FeaturedCard(
      fixture({ projectionError: new Error('down') }).props,
    )
    assert.equal(buttonByText(tree, 'Read front & back'), undefined)
  })

  it('offers the transition into graph exploration on the same slug', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    const links = walk(
      FeaturedCard(fixture().props),
      (vnode) => vnode.props?.['data-testid'] === 'explore-in-graph',
    )
    assert.equal(links.length, 1)
    assert.equal(
      links[0].props?.href,
      `/graph?focus=${encodeURIComponent(OPEN_CARD.slug)}`,
    )
    assert.ok(html.includes('Explore in graph'))
  })
})
