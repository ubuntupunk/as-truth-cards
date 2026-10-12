/**
 * Tests for `featured-card.tsx` and the regions it composes — SPEC §6.2,
 * §7 and §15.
 *
 * The contract is the two-faced card: the front (Cover) shows title +
 * designed fallback and `Read front & back`; the back carries the Claim face
 * (formulation, status, classification, framing, `Read analysis`) and then the
 * Analysis face (provenance, evidence, the three reading lists, an honest
 * limitations note) plus `Back to front`. The flip is presentation-only: the
 * inactive face is `inert` + `aria-hidden` and `data-flipped` drives the
 * transform. Title, summary, classification, provenance and evidence stay
 * separate regions; the status reaches the screen only as `OPEN · UNVERIFIED`;
 * `Save card` is disabled with its reason as visible text; and the sources
 * list never merges into claims or evidence.
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

/** Counters for the four stage transitions, so a click can be proven. */
type Transitions = {
  examine: number
  read: number
  back: number
  close: number
}

/** The featured card wired to the fixture card, at the Cover by default. */
function fixture(overrides: Partial<FeaturedCardProps> = {}): {
  props: FeaturedCardProps
  state: Transitions
} {
  const state: Transitions = { examine: 0, read: 0, back: 0, close: 0 }
  const props: FeaturedCardProps = {
    card: OPEN_CARD,
    idLabel: 'Card / ID-07',
    preview: PREVIEW,
    reading: READING,
    stage: 'cover',
    onExamine: () => {
      state.examine += 1
    },
    onReadAnalysis: () => {
      state.read += 1
    },
    onBackToClaim: () => {
      state.back += 1
    },
    onClose: () => {
      state.close += 1
    },
    ...overrides,
  }
  return { props, state }
}

describe('FeaturedCard — Cover', () => {
  it('opens on the Cover with the title and a deliberate fallback', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.match(html, /data-stage="cover"/)
    assert.ok(html.includes('data-testid="card-cover"'))
    assert.ok(html.includes('data-testid="card-cover-fallback"'))
    assert.ok(html.includes('data-testid="card-cover-id"'))
    assert.ok(html.includes('Card / ID-07'))
    assert.ok(html.includes(OPEN_CARD.title as string))
  })

  it('keeps the claim, analysis and metadata regions off the Cover', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(!html.includes('data-testid="card-claim"'))
    assert.ok(!html.includes('data-testid="card-analysis"'))
    assert.ok(!html.includes('data-testid="card-metadata"'))
    assert.ok(!html.includes('data-testid="card-reading"'))
  })

  it('renders a rights-cleared image with alt text and attribution', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          coverImage: {
            src: 'https://example.test/cover.jpg',
            alt: 'A photograph of a described subject',
            attribution: 'Photo: Example Archive, public domain',
          },
        }).props}
      />,
    )
    assert.ok(html.includes('data-testid="card-cover-image"'))
    assert.ok(html.includes('alt="A photograph of a described subject"'))
    assert.ok(html.includes('Photo: Example Archive, public domain'))
    assert.ok(!html.includes('data-testid="card-cover-fallback"'))
  })

  it('falls back when the image has no descriptive alt text', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          coverImage: { src: 'https://example.test/cover.jpg', alt: '  ' },
        }).props}
      />,
    )
    assert.ok(!html.includes('data-testid="card-cover-image"'))
    assert.ok(html.includes('data-testid="card-cover-fallback"'))
  })

  it('offers Read front & back, and the flip opens the card back', () => {
    const { props, state } = fixture()
    const tree = FeaturedCard(props)
    const html = render(tree)
    const flip = buttonByText(tree, 'Read front & back')
    assert.ok(flip)
    assert.equal(flip?.props?.['data-testid'], 'flip-card')
    assert.ok(html.includes('data-testid="flip-card"'))
    ;(flip?.props?.onClick as () => void)()
    assert.equal(state.examine, 1)
    assert.equal(state.read, 0)
  })
})

describe('FeaturedCard — faces', () => {
  it('keeps both faces in the DOM on the front, the back inert', () => {
    const { props } = fixture({ stage: 'cover' })
    const tree = FeaturedCard(props)
    const html = render(tree)
    const front = walk(
      tree,
      (v) => v.props?.['data-testid'] === 'card-face-front',
    )
    const back = walk(
      tree,
      (v) => v.props?.['data-testid'] === 'card-face-back',
    )
    assert.equal(front.length, 1)
    assert.equal(back.length, 1)
    assert.equal(front[0].props.inert, undefined)
    assert.equal(front[0].props['aria-hidden'], undefined)
    assert.equal(back[0].props.inert, true)
    assert.equal(back[0].props['aria-hidden'], 'true')
    assert.match(html, /data-testid="card-flip-stage"[^>]*data-flipped="false"/)
  })

  it('shows the back on a flipped stage, the front face inert', () => {
    const { props } = fixture({ stage: 'claim' })
    const tree = FeaturedCard(props)
    const html = render(tree)
    const front = walk(
      tree,
      (v) => v.props?.['data-testid'] === 'card-face-front',
    )
    const back = walk(
      tree,
      (v) => v.props?.['data-testid'] === 'card-face-back',
    )
    assert.equal(front[0].props.inert, true)
    assert.equal(front[0].props['aria-hidden'], 'true')
    assert.equal(back[0].props.inert, undefined)
    assert.equal(back[0].props['aria-hidden'], undefined)
    assert.match(html, /data-testid="card-flip-stage"[^>]*data-flipped="true"/)
  })

  it('renders the designed cover fallback with folio and grid band', () => {
    const html = render(<FeaturedCard {...fixture().props} />)
    assert.ok(html.includes('data-testid="card-cover-fallback"'))
    assert.ok(html.includes('data-testid="card-cover-folio"'))
    assert.ok(html.includes('deck-cover-grid'))
    assert.ok(html.includes('ID-07'))
    assert.ok(!html.includes('border-dashed'))
  })
})

describe('FeaturedCard — Claim face', () => {
  it('shows the formulation, status, classification and framing', () => {
    const html = render(<FeaturedCard {...fixture({ stage: 'claim' }).props} />)
    assert.match(html, /data-stage="claim"/)
    assert.ok(html.includes('data-testid="card-claim"'))
    assert.ok(html.includes('data-testid="card-metadata"'))
    assert.ok(html.includes('data-testid="card-id-label"'))
    assert.match(html, /data-testid="card-status-badge"[^>]*data-status="OPEN"/)
    assert.ok(html.includes('OPEN · UNVERIFIED'))
    assert.ok(html.includes('data-unverified="true"'))
    assert.ok(html.includes('What is asserted'))
    assert.ok(html.includes(OPEN_CARD.coreQuestion as string))
    assert.ok(html.includes('Research framing'))
    assert.ok(html.includes(OPEN_CARD.summary as string))
    assert.ok(html.includes('data-testid="classification-tags"'))
  })

  it('never shows the raw enum as badge text', () => {
    const html = render(<FeaturedCard {...fixture({ stage: 'claim' }).props} />)
    assert.ok(!html.includes('>OPEN<'))
    assert.ok(!html.includes('epistemic_status'))
  })

  it('says the established card is established, with no amber', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          stage: 'claim',
          card: ESTABLISHED_CARD,
          idLabel: 'Card / ID-02',
        }).props}
      />,
    )
    assert.ok(html.includes('ESTABLISHED'))
    assert.ok(!html.includes('data-unverified'))
  })

  it('falls back to an honest claim line when none is recorded', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          stage: 'claim',
          card: ESTABLISHED_CARD,
          idLabel: 'Card / ID-02',
        }).props}
      />,
    )
    assert.ok(html.includes('No claim formulation recorded for this card.'))
  })

  it('prefixes every classification chip with its dimension', () => {
    const html = render(<FeaturedCard {...fixture({ stage: 'claim' }).props} />)
    const dimensions = walk(
      FeaturedCard(fixture({ stage: 'claim' }).props),
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
    const html = render(<FeaturedCard {...fixture({ stage: 'claim' }).props} />)
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

  it('offers Read analysis on the Claim face, and it opens the Analysis', () => {
    const { props, state } = fixture({ stage: 'claim' })
    const tree = FeaturedCard(props)
    const read = buttonByText(tree, 'Read analysis')
    assert.ok(read)
    assert.equal(read?.props?.['data-testid'], 'read-analysis')
    ;(read?.props?.onClick as () => void)()
    assert.equal(state.read, 1)
  })

  it('flips back to the front from the Claim face', () => {
    const { props, state } = fixture({ stage: 'claim' })
    const back = buttonByText(FeaturedCard(props), 'Back to front')
    assert.equal(back?.props?.['data-testid'], 'back-to-front')
    ;(back?.props?.onClick as () => void)()
    assert.equal(state.close, 1)
  })

  it('replaces the derived half with one error state when the projection fails', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          stage: 'claim',
          preview: null,
          reading: null,
          projectionError: new Error('projection rejected'),
        }).props}
      />,
    )
    // One display for one failure: no preview, no open reading, and no read
    // control that would open into nothing — but the listing half stays.
    assert.ok(!html.includes('data-testid="provenance-preview"'))
    assert.ok(!html.includes('data-testid="card-reading"'))
    assert.ok(html.includes('projection rejected'))
    assert.ok(html.includes(OPEN_CARD.title as string))
  })

  it('omits Read analysis when there is no projection to open', () => {
    const tree = FeaturedCard(
      fixture({ stage: 'claim', projectionError: new Error('down') }).props,
    )
    assert.equal(buttonByText(tree, 'Read analysis'), undefined)
    // The reverse flip stays, so the reader is never stranded on a dead face.
    assert.ok(buttonByText(tree, 'Back to front'))
  })
})

describe('FeaturedCard — Analysis face', () => {
  it('shows provenance, evidence and the three reading lists', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
    for (const testid of [
      'card-analysis',
      'provenance-preview',
      'evidence-state',
      'card-reading',
      'card-actions',
    ])
      assert.ok(html.includes(`data-testid="${testid}"`), testid)
    assert.ok(html.includes('Claims'))
    assert.ok(html.includes('Reasoning steps'))
    assert.ok(html.includes('aria-label="Sources"'))
    assert.ok(html.includes('Jesus was born in Bethlehem'))
    assert.ok(html.includes('Bridges the two claims.'))
    assert.ok(html.includes('A. Author, A primary source (A Press, 2026).'))
  })

  it('reports claims, steps and this card\u2019s sources as counts', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
    assert.ok(html.includes('2 claims'))
    assert.ok(html.includes('2 steps'))
    assert.ok(html.includes('1 source'))
    assert.ok(!html.includes('0 sources'))
  })

  it('reports the view\u2019s reason for evidence instead of a fabricated zero', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
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
          stage: 'analysis',
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
      <FeaturedCard
        {...fixture({ stage: 'analysis', preview: null, reading: null }).props}
      />,
    )
    assert.ok(html.includes('Loading card details…'))
    assert.ok(html.includes('—'))
    assert.ok(html.includes('Loading reading…'))
    assert.ok(!html.includes('0 claims'))
    assert.ok(!html.includes('0 sources'))
  })

  it('says in words that a source is neither evidence nor a claim', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
    assert.ok(
      html.includes(
        'Sources document where a claim came from; they are not evidence and',
      ),
    )
  })

  it('reads a claim status through the presentation mapping only', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
    assert.ok(html.includes('data-claim-status="ESTABLISHED"'))
    assert.ok(!html.includes('data-claim-status="OPEN"'))
  })

  it('represents counterevidence as not carried, not as absent', () => {
    const html = render(
      <FeaturedCard {...fixture({ stage: 'analysis' }).props} />,
    )
    assert.ok(html.includes('Counterevidence &amp; limitations'))
    assert.ok(
      html.includes(
        'Counterevidence, uncertainty, and unresolved questions are not carried',
      ),
    )
  })

  it('returns to the Claim and flips back to the front from Analysis', () => {
    const { props, state } = fixture({ stage: 'analysis' })
    const tree = FeaturedCard(props)
    const back = buttonByText(tree, 'Back to claim')
    assert.equal(back?.props?.['data-testid'], 'back-to-claim')
    ;(back?.props?.onClick as () => void)()
    assert.equal(state.back, 1)
    const close = buttonByText(tree, 'Back to front')
    ;(close?.props?.onClick as () => void)()
    assert.equal(state.close, 1)
  })

  it('replaces the face with the error state when the projection fails', () => {
    const html = render(
      <FeaturedCard
        {...fixture({
          stage: 'analysis',
          preview: null,
          reading: null,
          projectionError: new Error('projection rejected'),
        }).props}
      />,
    )
    assert.ok(!html.includes('data-testid="card-analysis"'))
    assert.ok(!html.includes('data-testid="card-reading"'))
    assert.ok(html.includes('projection rejected'))
  })
})

describe('FeaturedCard — independent actions', () => {
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
