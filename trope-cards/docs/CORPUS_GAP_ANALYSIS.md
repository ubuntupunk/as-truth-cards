# Corpus gap analysis — v0.11

Written **before** any seed change, so the decisions below are auditable against the state they
describe. Baseline is `fc45045` plus the Graphology phase (`4f0e31c`), verified against
`trope_cards_dev`.

## 1. What the corpus actually contains

47 cards, 19 claims, 4 inference steps, 2 argument chains, 11 card-to-card edges.

| Table | Rows | Assessment |
|---|---|---|
| `cards` | 47 | complete; authored corpus is fully seeded |
| `claims` | 19 | **6 of 47 cards have any claim at all** |
| `claim_relations` | 0 | **table and 11-value enum exist, nothing written** |
| `sources` | 0 | schema complete, no bibliographic records |
| `evidence_items` | 0 | vocabulary only, correctly so (see §4) |
| `claim_sources` | 0 | follows `sources` |
| `inference_steps` | 4 | 2 cards, all `CONTESTED`, all identity-retrospection |
| `argument_chains` | 2 | the same 2 cards |
| `cases` / `interpretations` / `questions` | 0 | see §5 |
| `concepts` | 6 | taxonomy rows exist; `card_concepts` is 0, deliberately (Q2) |

## 2. Claim coverage by card status

The distribution is the finding. Claims are not spread thin across the corpus — they are absent
from it, and concentrated in one editorial cluster.

| Card status | Cards | With claims |
|---|---|---|
| CONTESTED | 21 | 6 |
| CONTEXT_DEPENDENT | 15 | 0 |
| ESTABLISHED | 8 | **0** |
| LIVE | 3 | 0 |

Every claim in the corpus belongs to the Identity Retrospection cluster
(`jesus-is-a-muslim`, `jesus-was-a-palestinian`, `muhammad-was-a-zionist`,
`land-of-the-children-of-israel`, `jesus-was-a-zionist`, `canaanite-card`).

This is backwards. The `ESTABLISHED` cards are reference material whose summaries state
checkable facts — `elders-of-zion` is a card *about* a fabricated text, `jews-are-not-semites`
explains a documented coinage, `voting-rights` separates two legal statuses. Those are the cards
whose content decomposes into claims most directly, and they have none. The 15
`CONTEXT_DEPENDENT` cards are mostly tactic descriptions where a claim would assert the trope
rather than describe it, which is a different and riskier editorial act.

## 3. Increment chosen, and why

**Claims for the 7 `ESTABLISHED` cards whose summaries state factual propositions.** 14 claims,
across 7 cards (2–3 each).

`chronology` is deliberately excluded: its summary ("Places competing national movements and
political developments on their respective timelines") describes what the card *does*, not a
proposition the card asserts.

Each claim is a decomposition of that card's existing `summary` or `editorialNotes` — nothing
new is asserted. The test applied to every one: *is this claim already entailed by the card's
authored text?* Where the answer was no, the claim was not written. Examples of claims that were
**not** written because they failed that test: which translator's rendering of a passage
supports a claim, which year a specific policy began, what a named person's stated intent was.

**`claim_relations`: 5 rows — 3 on `canaanite-card`, 1 on `jesus-was-a-zionist`, 1 on
`palestinian-flag`.**
Chosen under a strict rule: encode a relation only where a claim's *own prose* asserts it, and
never re-encode the inference decomposition. So `modern-zionism-later-political-category` →
`jesus-zionist-interpretive-inference` is **not** written as a claim relation, because it is
already the `PRIMARY` premise of the "Historical-category distinction" step — writing it twice
would blur the line between direct relations and argumentative structure.

**Sources: 3 rows**, one per real document named in the authored material — the Qur'an
(`land-of-the-children-of-israel` `editorialNotes` asks for it explicitly), the Protocols
(`elders-of-zion`), and the Merneptah Stele (named in the existing `merneptah-israel-attestation`
claim). Each is a bibliographic fact about a document that exists, attached to the claims that
already attribute themselves to it, giving **6 `claim_sources` rows** with `relationship =
ATTRIBUTED_TO` and no quotation.

**Slugs on `newIdentityClaims`.** A claim can only be named by its label, so attaching the
Qur'an to the three claims that name it required adding stable slugs to all 9 of those claims.
They previously had none, which is why the old runner inserted them in a separate loop that never
resolved an id. All three claim files now share one insert path.

## 4. Why `evidence_items` stays empty

The instruction permits evidence "where there is an actual source/evidence basis". Recording an
evidence item requires `content` — a located passage — plus `locator` and `locatorType`. I can
name the Qur'an; I cannot assert a specific verse number and translation wording that survives
verification. Generating a plausible-looking quotation is precisely the failure
`seed/index.ts` already documents refusing:

> There are no located passages to record yet, and inventing them would misrepresent evidence
> that does not exist.

So the corpus gains the bibliographic layer and stops short of the excerpt layer. A claim can
name the document it rests on without pretending to quote it. `claim_sources.relationship` is
therefore a single value, `ATTRIBUTED_TO`, matching the verb the claims themselves use.

## 5. Why cases, interpretations and questions stay empty

- **Cases.** The 3 `LIVE` cards are South African institutional disputes, and `cases` has a
  `caseStatus` enum plus `date_start`/`date_end`. Filling it means asserting dockets, dates and
  procedural posture. The authored summaries are one sentence each and name no case identifiers.
  Not enough to assert.
- **Interpretations.** `interpretations` requires an author's reading of a claim
  (`claim_interpretations` is the link). Nothing in the corpus attributes an interpretation to a
  named person.
- **Questions.** The 2 cards carrying `coreQuestion` are already `questions`-adjacent by that
  field. A `questions` row would duplicate authored text into a table that also wants
  `question_claims`/`question_cards` bindings, which would be a second home for the same editorial
  decision.

## 6. Ontology questions genuinely needing a decision

1. **Should a `summary` be a claim, or only evidence for one?** This increment decomposes
   summaries into claims. If summaries are instead meant to stay one level above the ontology, this
   increment is the wrong direction and should be reverted.
2. **Does a `claim_relations` row duplicate `inference_premises`?** The rule applied here is
   prose-only and never duplicates a binding, but the schema permits the same pair in both tables
   with different semantics. Nothing prevents a future author from writing both.
3. **`claim_sources` cardinality.** Primary key is `(claim_id, source_id)`, so one claim can name
   one document only once. A claim resting on two translations of the same text needs an
   `evidence_items` row per rendering, which §4 declines to create.

---

## 7. Applied — verified outcome

Written after `pnpm run trope-graph:check` passed against `trope_cards_dev`.

| Table | Before | After |
|---|---|---|
| `claims` | 19 | 33 |
| cards with no claims | 41 | 34 |
| `claim_relations` | 0 | 5 |
| `sources` | 0 | 3 |
| `claim_sources` | 0 | 6 |
| `evidence_items` | 0 | 0 |

Cards are unchanged at 47, as are `inference_steps` (4), `inference_premises` (9),
`inference_conclusions` (4), `argument_chains` (2), `relationships` (11), `card_concepts` (0),
and the Axis and Locale sets. This increment adds claims and attribution only; it does not
restructure reasoning that already existed.

### What the verification actually proves

- **Idempotency.** The seed ran twice; no table grew. `sources` has no unique constraint, so the
  runner reads on title before inserting — `verify-seed.ts` asserts title uniqueness, because
  that read is the only thing keeping re-runs from duplicating.
- **The prose-only relation rule holds.** `seed-corpus.test.ts` builds the set of
  premise→conclusion pairs the decomposition engine wires (9 of them) and asserts no seeded
  claim relation restates one. Mutation-tested: inserting
  `modern-zionism-later-political-category SUPPORTS jesus-zionist-interpretive-inference` fails
  the suite.
- **The no-fabrication decision is enforced, not just documented.** No attribution asserts a
  quote or locator. Asserted on the seed files (`seed-corpus.test.ts`), on the database
  (`verify-seed.ts` and `seed-corpus.integration.test.ts`), so a manual insert cannot introduce
  an unverifiable excerpt either. `evidence_items` is asserted empty in three places.
- **Q1 is now exercised.** `claim_relations` had 0 rows for its whole life, so "read authored
  only, never infer" was untestable. With 5 rows,
  `graph-projection.integration.test.ts` asserts every `claim_relation` edge carries
  `sourceTable === 'claim_relations'`. B2 is closed and the tripwire that flagged it has been
  rewritten to name the decision behind each now-non-zero count.

### Carried forward

Cards without claims: 34. Two groups, both deliberate. The 152-claim v0.4 corpus stays deferred
pending source verification. The tactic cards describe an operation rather than assert a
proposition, so a claim on them would assert the trope — a different editorial act than
decomposing a reference card, and not covered by §3's reasoning.

---

## 8. Architect decisions D1/D2, and the Q2 Concept task

Issue #3 answered the three questions in §6. Both recommendations were accepted, with two rules
added that change what the data must prove.

### D1 — a Summary may contain claims; it is not one

> A Card Summary is authored card-level prose. A Summary may contain one or more claim-level
> propositions. A proposition may be decomposed into a first-class Claim when it is explicitly
> asserted by the authored Summary/editorial material and passes the entailment test already
> documented. Descriptive/framing prose is not a Claim. Do not manufacture a proposition simply to
> populate the Claims table. **A Claim derived from Summary text does not inherit the Card's
> epistemic status automatically.**

The 14 claims stay. What needed fixing was that the *rule* was unenforced — the runner reads
`seed.status` and never reads the card's status, so the behaviour was correct by construction and
invisible to any test. All 14 sit on `ESTABLISHED` cards at `ESTABLISHED`, so the data cannot
distinguish an independent judgement from a copied value.

`seed-corpus.test.ts` now asserts the distinction in the direction that can actually fail. A
blanket rule ("a claim's status must differ from its card's") would be wrong — it would force a
false status onto any claim genuinely as well-established as its card. So the test asserts the
corpus *can* express a divergence (it does: 9 claims on `CONTESTED` cards are `ESTABLISHED`), and
names the two `voting-rights` claims individually. Those are the ones where the card's
`ESTABLISHED` status could most easily have been copied onto a claim that is actually contestable;
they are graded `ESTABLISHED` because each states a documented fact about who may vote, not an
interpretive position.

**D1 also terminates the decomposition work rather than extending it.** Applying "descriptive and
framing prose is not a Claim" to the 34 remaining claimless cards leaves nothing to add:

| Group | Cards | Why no claim follows |
|---|---|---|
| `chronology` | 1 | Summary is "Places competing national movements … on their respective timelines" — describes the card's operation. |
| CONTESTED | 18 | Summaries open "Separates…", "Examines…", "Compares…". `depo-provera` goes further, distinguishing *allegations* and *claims about state intent*, so asserting any would assert the allegation. |
| CONTEXT_DEPENDENT | 15 | Tactic descriptions; a claim would assert the trope. |
| LIVE | 3 | Institutional disputes with no dockets, dates, or procedural posture to assert. |

One case is genuinely borderline and is **not** written: `chosen-people-master-race`, whose summary
is "Examines the translation of the Jewish theological concept of chosenness into a
racial-supremacy category." Whether "Examines X" asserts X is an editorial judgement about the
Summary/Claim boundary, which is D1's to make, not this increment's. Flagged rather than decided.

So the remaining corpus gap is not unfinished decomposition. It is **absent authored prose**: new
claims need new card text, not new analysis of existing text.

### D2 — `claim_sources` stays

Accepted as a bibliographic attribution layer distinct from located evidence. Nothing changes; the
6 rows keep `ATTRIBUTED_TO` with null quote and locator. B5 stays open, with its trigger recorded
as "when the evidence corpus is sufficiently populated".

### Q2 — Concept task

**Slug collision: there were two, and they were duplicates.** `collectivisation` and
`racial-essentialism` existed in both tables with near-identical definitions — the concept
"attributing the conduct of an individual to a wider collective" against the mechanism "moves
from an individual, institution, or government to a whole group".

Resolved by **removing the two concepts, not renaming them**. A renamed duplicate would keep the
mechanism's canonical slug and differ only in wording, so a reader handed `collectivisation` still
could not tell which table it named — the ambiguity would survive, just harder to see. A concept
that restates a mechanism also has no independent job: it is one editorial fact in two places,
which is the duplication Q1 forbids between `claim_relations` and `inference_*`. Concepts 6→4:
`antisemitism`, `anti-zionism`, `zionism`, `historical-analogy`.

**`card_concepts`: 0 → 12 across 8 cards**, each link carrying the card sentence that justifies
it. Q2 forbids inventing associations for coverage, so 15 CONTEXT_DEPENDENT cards that could all
be argued into `antisemitism` are absent — none of them say so.

**`anti-zionism` is a deliberate orphan.** No card in the corpus discusses opposition to Zionism
as a subject. The verifier names it as a recorded gap and still fails on any *new* orphan, so the
check stays strict without inventing a link.

**Concept is still excluded from both views**, but no longer on corpus grounds. `card_concepts` is
populated; the blocker is that no reader path loads it, so the projection cannot emit a Concept
node. That is projection work, not corpus work, and B1 now says so.
