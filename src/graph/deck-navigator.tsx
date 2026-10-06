/**
 * The Graph explorer's navigator sidebar — the `trope_deck_axis_suit_ui.html`
 * slice of the approved mockup.
 *
 * Three single-select groups over one projection:
 *
 * - **Ontology type** — All / Claims / Evidence / Sources / Cases / Concepts /
 *   Interpretations / Inferences. A facet with zero nodes in the projection is
 *   rendered *disabled* with its count, so "this layer is empty in the corpus"
 *   is visible instead of presenting a filter that silently does nothing.
 * - **Suit — new** — coloured-dot rows derived from the projection's card
 *   nodes. A Suit is a card-level browse dimension, so selecting one narrows
 *   the graph to cards in that Suit.
 * - **Axis — new** — icon rows in canonical `card_axis` order. Same card-level
 *   semantics, distinct encoding (the axis-memo §4 requirement: axis reads
 *   differently from mechanism/concept tags).
 *
 * The component is pure — facets/filter in, `onChange` out — and its icons are
 * inline SVGs, which keeps it renderable by `preact-render-to-string` under
 * Node with no DOM and no `react`-coupled icon library. It computes no
 * semantics itself: every item comes from `deriveFacets` and every selection is
 * reported verbatim; `pages/Graph.tsx` applies the filter.
 */

import type {
  CardAxisValue,
  GraphNodeType,
} from '../../trope-cards/src/graph/types.ts'
import {
  type DeckFacets,
  type FacetFilter,
  SUIT_DOT_COLORS,
} from './deck-facets'

/** Unset-state: "All" for the type group. */
const ALL_TYPE: GraphNodeType | null = null

type IconComponent = (props: {
  className?: string
}) => import('preact').JSX.Element

/**
 * The axis icon by canonical `card_axis` value.
 *
 * Built lazily behind this function (rather than as a module-time object) so
 * the icon components below can stay arrow consts with no TDZ hazard.
 *
 * @param axis The card axis value.
 * @returns The icon component for that axis.
 */
function axisIconFor(axis: CardAxisValue): IconComponent {
  switch (axis) {
    case 'TACTIC':
      return TheaterIcon
    case 'FACT_REBUTTAL':
      return ScaleIcon
    case 'THEOLOGICAL':
      return BookIcon
    case 'HISTORICAL':
      return LandmarkIcon
  }
}

/**
 * The navigator sidebar.
 *
 * @param props.facets The facets derived from the current projection.
 * @param props.filter The active filter (`NO_FACET_FILTER` when unfiltered).
 * @param props.onChange Fired with the next filter after any selection change.
 * @returns An `<aside>` navigator with the three mockup groups.
 */
export function DeckNavigator({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <aside
      className="rounded-xl border bg-background p-3"
      data-testid="deck-navigator"
    >
      <OntologyTypeGroup facets={facets} filter={filter} onChange={onChange} />
      <SuitGroup facets={facets} filter={filter} onChange={onChange} />
      <AxisGroup facets={facets} filter={filter} onChange={onChange} />
    </aside>
  )
}

/** The "Ontology type" group: All plus the ontology-type facets. */
function OntologyTypeGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div className="mb-4">
      <GroupHeading>Ontology type</GroupHeading>
      <FacetList>
        <FacetRow
          label="All"
          selected={filter.type === ALL_TYPE}
          onClick={() => onChange({ ...filter, type: ALL_TYPE })}
        >
          <AllIcon className="h-3.5 w-3.5 shrink-0" />
        </FacetRow>
        {facets.types.map((facet) => (
          <FacetRow
            key={facet.type}
            label={facet.label}
            count={facet.count}
            selected={filter.type === facet.type}
            disabled={!facet.present}
            title={
              facet.present
                ? undefined
                : `No ${facet.label.toLowerCase()} in the current projection`
            }
            onClick={() =>
              onChange({
                ...filter,
                type: filter.type === facet.type ? ALL_TYPE : facet.type,
              })
            }
          >
            <FacetTypeIcon type={facet.type} className="h-3.5 w-3.5 shrink-0" />
          </FacetRow>
        ))}
      </FacetList>
    </div>
  )
}

/** The "Suit — new" group: coloured-dot rows. */
function SuitGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div className="mb-4">
      <GroupHeading newTag>Suit</GroupHeading>
      <FacetList>
        {facets.suits.map((facet) => (
          <FacetRow
            key={facet.slug}
            label={facet.label}
            count={facet.count}
            selected={filter.suit === facet.slug}
            onClick={() =>
              onChange({
                ...filter,
                suit: filter.suit === facet.slug ? null : facet.slug,
              })
            }
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: SUIT_DOT_COLORS[facet.slug] ?? '#94a3b8',
              }}
              aria-hidden="true"
            />
          </FacetRow>
        ))}
      </FacetList>
    </div>
  )
}

/** The "Axis — new" group: icon rows in canonical order. */
function AxisGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div>
      <GroupHeading newTag>Axis</GroupHeading>
      <FacetList>
        {facets.axes.map((facet) => {
          const Icon = axisIconFor(facet.axis)
          return (
            <FacetRow
              key={facet.axis}
              label={facet.label}
              count={facet.count}
              selected={filter.axis === facet.axis}
              onClick={() =>
                onChange({
                  ...filter,
                  axis: filter.axis === facet.axis ? null : facet.axis,
                })
              }
            >
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
            </FacetRow>
          )
        })}
      </FacetList>
    </div>
  )
}

/** Group title, with the mockup's inline "— new" tag. */
function GroupHeading({
  children,
  newTag,
}: {
  children: import('preact').ComponentChildren
  newTag?: boolean
}) {
  return (
    <p className="mb-1 px-2 text-[13px] font-medium text-foreground">
      {children}
      {newTag ? (
        <span className="ml-1 font-normal text-muted-foreground">— new</span>
      ) : null}
    </p>
  )
}

/** The tight vertical stack of facet rows. */
function FacetList({
  children,
}: {
  children: import('preact').ComponentChildren
}) {
  return <div className="flex flex-col gap-0.5">{children}</div>
}

/**
 * One selectable facet row.
 *
 * @param props.label The human facet label.
 * @param props.count Optional node count shown at the right edge.
 * @param props.selected Whether this row is the group's active selection.
 * @param props.disabled Whether the facet is empty-in-projection.
 * @param props.title Native tooltip, used to explain disabled facets.
 * @param props.onClick The row activation handler.
 */
function FacetRow({
  label,
  count,
  selected,
  disabled,
  title,
  onClick,
  children,
}: {
  label: string
  count?: number
  selected?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children: import('preact').ComponentChildren
}) {
  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors ${
        selected ? 'bg-muted text-foreground' : 'text-muted-foreground'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
    >
      {children}
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      ) : null}
    </button>
  )
}

/** The ontology-type facet icon, by type. */
function FacetTypeIcon({
  type,
  className,
}: {
  type: GraphNodeType
  className?: string
}) {
  switch (type) {
    case 'claim':
      return <QuoteIcon className={className} />
    case 'evidence_item':
      return <FileCheckIcon className={className} />
    case 'source':
      return <BookIcon className={className} />
    case 'case':
      return <GavelIcon className={className} />
    case 'concept':
      return <SparkIcon className={className} />
    case 'interpretation':
      return <MessageIcon className={className} />
    case 'inference_step':
      return <GitBranchIcon className={className} />
    default:
      return <DotIcon className={className} />
  }
}

/** A 24×24 stroke icon wrapper shared by every inline SVG below. */
function Icon({
  className,
  children,
}: {
  className?: string
  children: import('preact').ComponentChildren
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** "All" — a grid of every ontology type. */
const AllIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
)

/** Claims — a quotation mark. */
const QuoteIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 21c3-1 5-3 5-6V9H3v6h4" />
    <path d="M13 21c3-1 5-3 5-6V9h-5v6h4" />
  </Icon>
)

/** Evidence — a document with a check mark. */
const FileCheckIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
    <path d="m9 15 2 2 4-4" />
  </Icon>
)

/** Sources / Library — an open book. */
const BookIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 5a3 3 0 0 0-3-3H3v18h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6V2h-6a3 3 0 0 0-3 3Z" />
  </Icon>
)

/** Cases — a gavel. */
const GavelIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="m14 13-7.5 7.5a2.121 2.121 0 0 1-3-3L11 10" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </Icon>
)

/** Concepts — a spark/idea glyph. */
const SparkIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    <circle cx="12" cy="12" r="3.5" />
  </Icon>
)

/** Interpretations — a speech bubble. */
const MessageIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12Z" />
  </Icon>
)

/** Inferences — a branching arrow. */
const GitBranchIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 6h5a4.5 4.5 0 0 1 4.5 4.5V12" />
    <path d="M8.5 18h3" />
  </Icon>
)

/** Axis: Tactic — a theatre/drama icon. */
const TheaterIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <rect x="3" y="7" width="18" height="10" rx="2" />
    <path d="M7 10h.01M12 10h.01M17 10h.01" />
    <path d="M21 17l-3 3-3-3 3-3Z" />
    <path d="m6 20 3-3 3 3" opacity="0.4" />
  </Icon>
)

/** Axis: Fact-rebuttal — a balance scale. */
const ScaleIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 3v18M8 21h8" />
    <path d="M12 6 4 11l4 2 4-7Z" />
    <path d="M12 6l8 5-4 2-4-7Z" />
  </Icon>
)

/** Axis: Theological — a book. */
const LandmarkIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 21h18" />
    <path d="M5 21V8" />
    <path d="M19 21V8" />
    <path d="M5 8 12 3l7 5" />
  </Icon>
)

/** Fallback type icon — a plain dot. */
const DotIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="4" />
  </Icon>
)
