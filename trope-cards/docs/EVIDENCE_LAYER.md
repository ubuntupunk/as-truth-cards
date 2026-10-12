# Evidence Layer

## Principle

A source is a bibliographic object. Evidence is a located, inspectable portion or observation derived from that source.

Do not attach a source directly to a claim when the relevant passage/page/data point is known. Create an evidence item.

## Attaching a source to a claim

A claim reaches a source by exactly two routes, and they mean different things (`as-truth-cards-lpp`,
§11 Q11 of `GRAPH_PROJECTION_DESIGN.md`):

- **Support — evidence-mediated only.** Claim → `evidence_claims` → evidence item → `evidence_sources`
  → source. When a passage/page/data point is known, it is recorded as an evidence item here, and
  this chain is the *only* path the projection treats as support.
- **Attribution — `claim_sources`.** A bibliographic, passage-less record that a claim was read
  from a source: `relationship = ATTRIBUTED_TO` with `quote_or_excerpt` and `page_reference` null
  (or otherwise unlocated notes). The table is **deprecated as a path for located support**: do
  not add a `claim_sources` row once the passage is known — that belongs in an evidence item. It
  stays because the corpus has no evidence rows yet and a claim's bibliography must still be
  recordable. Do not use `claim_sources.relationship` as an evidential relation; it is always
  attribution (`ATTRIBUTED_TO`).

The two routes never collapse: attribution is projected in the `source` edge family, support in the
`evidence` families.

## Evidence types

- QUOTATION — verbatim passage, within copyright limits
- PARAPHRASE — researcher-authored summary of a passage
- DATA_POINT — table, dataset, statistic, measurement
- DOCUMENT_FEATURE — structural/documentary fact
- IMAGE_FEATURE — observation from an image/map/scan
- TESTIMONY — attributed testimony or reported statement
- SECONDARY_ASSESSMENT — author's assessment of evidence

## Evidential relations

- SUPPORTS
- CHALLENGES
- QUALIFIES
- CONTEXTUALISES
- ILLUSTRATES
- REPORTS
- ATTRIBUTES

These describe the evidential relation asserted by the editor; they do not automatically determine claim truth.

## Relation vocabularies

The "how are these related" text columns across the schema (`claim_sources.relationship`,
`interpretation_sources.relationship`, `card_concepts.relationship`, and the four evidence
`relation` columns) previously shared no vocabulary and differed in nullability and defaults. They
now belong to one of two documented sets (reconciled by `as-truth-cards-lpp`; no database enum
was added — the columns stay `text`, and the vocabulary is enforced by the seed and the
projective tests):

- **Asserted relations** — what an editor asserts between a proposition and material or another
  proposition: `SUPPORTS`, `CHALLENGES`, `QUALIFIES`, `CONTEXTUALISES`, `ILLUSTRATES`, `REPORTS`,
  `ATTRIBUTES`. Column owners: `evidence_claims.relation` (`NOT NULL`), and any future
  `claim_sources`/`interpretation_sources` wording must draw from a *structural* set instead.
- **Structural relations** — provenance/mechanics, not a judgment about the proposition:
  `DERIVED_FROM` (`evidence_sources.relation`, default), `USED_BY` (`evidence_inferences.relation`,
  default), `ATTRIBUTED_TO` (`claim_sources.relationship`, the only permitted value there),
  and authored prose for `card_concepts.relationship` (a free-text sentence, not a controlled term).

Rationale for two sets rather than one: `DERIVED_FROM`/`USED_BY`/`ATTRIBUTED_TO` name *how the
rows are connected*; `SUPPORTS`/`CHALLENGES`/… name *what the editor is claiming*. One vocabulary
would let a derivation edge read like a rhetorical claim. `relationships.relationship_type` and
`claim_relations.relation_type` are already typed Postgres enums and are deliberately not merged
into either set.

## Location

An evidence item should preserve a locator whenever possible:
page, paragraph, section, chapter, verse, timestamp, figure, table, URL fragment, archive identifier, or source-specific locator.

## Epistemic separation

`evidence_status` describes the evidence item.
`claim.epistemic_status` describes the proposition.
`inference.status` describes the reasoning step.

Never collapse these into one status.

## Example

Source:
Gospel/Acts passage

Evidence:
Acts 1:6 passage concerning restoration of the kingdom to Israel

Claim:
Jesus' followers expected restoration concerning Israel

Inference:
This historical material is used by some interpreters as evidence of Jesus' continuing concern with Israel's restoration.

Conclusion:
"Jesus was a Zionist"

The conclusion remains an interpretive inference, not a source-level fact.
