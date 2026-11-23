/**
 * Regression test for selected controls on Deck and Explore (reported 2026-11-23).
 *
 * The graph appearance switcher paints its selected state with the global
 * `--graph-accent` pair, so it visibly repaints for the active theme/treatment.
 * Deck scope badges and the featured card's primary actions instead used the
 * raw inverse pair `bg-foreground text-background`: in dark mode `--foreground`
 * is near-white and `--background` near-black, so those controls stayed
 * white-on-black no matter which treatment was active. Active controls on these
 * pages must ride the same theme-responsive accent pair as graph actions.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { ToggleBadge } from '@/components/filter-chips'
import { BrowseRail } from './browse-rail'
import { CardActions } from './card-actions'
import { NO_SCOPE } from './deck-model'
import { DeckScopeBadges } from './deck-scope'
import { buttons, buttonsLabelled, childText } from './test-fixtures'

/** The class a selected control must carry to follow the global accent. */
const ACCENT_FILL = /(?<![-\w])bg-graph-accent(?![\w-])/
const ACCENT_TEXT = /(?<![-\w])text-graph-accent-foreground(?![\w-])/

/**
 * Assert that a control paints its selected/primary state with the global accent.
 *
 * @param button The rendered button vnode to inspect.
 * @param label Human label used in assertion messages.
 */
function assertAccentPainted(
  button: VNode & { props?: Record<string, unknown> },
  label: string,
): void {
  const className = String(button.props?.className ?? '')
  assert.match(
    className,
    ACCENT_FILL,
    `${label} must fill with the theme-responsive graph accent`,
  )
  assert.match(
    className,
    ACCENT_TEXT,
    `${label} must use the accent's paired foreground token`,
  )
  assert.doesNotMatch(
    className,
    /(?<![-\w])bg-foreground(?:[\s/]|$)/,
    `${label} must not hard-code the dark-mode white fill`,
  )
  assert.doesNotMatch(
    className,
    /(?<![-\w])text-background(?![\w-])/,
    `${label} must not hard-code the dark-mode black text`,
  )
}

/**
 * Find the first button whose flattened text matches a label.
 *
 * @param root The rendered vnode tree.
 * @param label The visible button text.
 * @returns The matching button vnode.
 */
function labelledButton(
  root: unknown,
  label: string,
): VNode & { props?: Record<string, unknown> } {
  const match = buttons(root).find((button) => childText(button) === label)
  assert.ok(match, `expected a button labelled ${label}`)
  return match
}

describe('selected controls follow the global theme accent', () => {
  it('paints the shared ToggleBadge selected state with the accent pair', () => {
    assertAccentPainted(
      ToggleBadge({
        active: true,
        onSelect: () => undefined,
        children: 'Tactic',
      }) as VNode & { props?: Record<string, unknown> },
      'selected ToggleBadge',
    )
  })

  it('paints Deck scope selections and Without repeats with the accent pair', () => {
    const tree = (
      <DeckScopeBadges
        total={47}
        served={47}
        shown={6}
        scope={{
          ...NO_SCOPE,
          axis: 'TACTIC',
          status: 'OPEN',
          locale: 'south-africa',
          withoutRepeats: true,
        }}
        axes={['TACTIC']}
        statuses={['OPEN']}
        locales={['south-africa']}
        onChange={() => undefined}
      />
    )

    for (const label of [
      'Without repeats',
      'Tactic',
      'Open questions',
      'South Africa',
    ]) {
      const button = buttonsLabelled(tree, label)[0]
      assert.ok(button, `expected a Deck scope control labelled ${label}`)
      assertAccentPainted(button, `Deck scope ${label}`)
    }
  })

  it('paints Browse rail active axis and locale rows with the accent pair', () => {
    const tree = (
      <BrowseRail
        axes={['TACTIC']}
        activeAxis="TACTIC"
        onChange={() => undefined}
        locales={['south-africa']}
        activeLocale="south-africa"
        onLocaleChange={() => undefined}
        graphHref="/graph"
      />
    )

    assertAccentPainted(labelledButton(tree, 'Tactic'), 'active Browse axis')
    assertAccentPainted(
      labelledButton(tree, 'South Africa'),
      'active Browse locale',
    )
  })

  it('paints the featured card primary actions with the accent pair', () => {
    const actions = {
      stage: 'cover' as const,
      onExamine: () => undefined,
      onReadAnalysis: () => undefined,
      onBackToClaim: () => undefined,
      onClose: () => undefined,
      slug: 'an-open-question',
    }

    assertAccentPainted(
      labelledButton(<CardActions {...actions} />, 'Read front & back'),
      'Read front & back',
    )
    assertAccentPainted(
      labelledButton(
        <CardActions {...actions} stage="claim" />,
        'Read analysis',
      ),
      'Read analysis',
    )
  })
})
