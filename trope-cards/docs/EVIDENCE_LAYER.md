# Evidence Layer

## Principle

A source is a bibliographic object. Evidence is a located, inspectable portion or observation derived from that source.

Do not attach a source directly to a claim when the relevant passage/page/data point is known. Create an evidence item.

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
