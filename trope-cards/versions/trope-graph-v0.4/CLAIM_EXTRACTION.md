# Trope Graph v0.4 — Full Claim Extraction

## Purpose

First-pass extraction of the current 41-card Draft.md into discrete claims. This is a **source-faithful migration**, not a fact-check. Statements are preserved at the level supported by the draft; unresolved or source-dependent assertions are explicitly flagged.

## Extraction rules

- A card is an entry point, not a single proposition.
- Each materially distinct proposition becomes a claim.
- `ESTABLISHED` means the draft presents the proposition as historical/definitional context without marking it contested; it does **not** constitute independent verification.
- `CONTESTED` preserves the draft's own contested/legitimate-debate framing.
- `CONTEXT_DEPENDENT` means the draft says interpretation depends on context or formulation.
- `LIVE` means the draft identifies an active/current procedural or evidentiary status.
- `SOURCE_REQUIRED` identifies a proposition for which the draft explicitly requests or clearly requires primary/authoritative sourcing.
- No external factual correction has been silently inserted.

## Summary

41 cards → 104 extracted claims.

| Card | Claims | Primary source needed | Contested/context-dependent |
|---|---:|---:|---:|
| Shylock | 3 | 1 | 1 |
| Mossad Agent | 3 | 1 | 1 |
| Zio Nazi | 3 | 1 | 2 |
| World Domination | 3 | 1 | 1 |
| Dual Loyalty | 3 | 1 | 1 |
| Blood Libel | 3 | 1 | 1 |
| Holocaust Denial/Distortion | 4 | 2 | 1 |
| Talmud | 4 | 2 | 2 |
| Chosen People/Master Race | 4 | 2 | 2 |
| Haavara/Blood for Goods | 4 | 3 | 2 |
| Elders of Zion | 4 | 2 | 1 |
| Jews Are Not White | 3 | 2 | 2 |
| Goy | 4 | 2 | 2 |
| Replacement Theology | 4 | 2 | 3 |
| Apartheid Collaborators | 4 | 3 | 3 |
| White, European Settlers | 3 | 2 | 2 |
| Settler-Colonialism | 4 | 3 | 4 |
| Zionist-as-Slur | 3 | 2 | 2 |
| Litmus Test/Deplatforming | 4 | 3 | 3 |
| Platform/Institutional Control | 4 | 2 | 2 |
| River to Sea | 4 | 3 | 4 |
| Weaponizing Antisemitism | 3 | 2 | 3 |
| Jews Are White | 3 | 2 | 2 |
| Jews Are Not Semites | 3 | 2 | 1 |
| Cape Union Mart | 5 | 4 | 2 |
| UCT Resolutions | 4 | 4 | 3 |
| SA Jews for a Free Palestine | 3 | 3 | 2 |
| Mendelsohn | 8 | 5 | 5 |
| Jerusalem Sovereignty | 4 | 3 | 2 |
| Quran/Land Claim | 3 | 3 | 3 |
| Apartheid Map | 4 | 3 | 3 |
| Voting Rights | 4 | 3 | 2 |
| Nakba Symmetry | 3 | 3 | 3 |
| Balfour/Colonial Origins | 4 | 5 | 3 |
| Palestinian Flag | 3 | 2 | 1 |
| Chronology | 3 | 3 | 2 |
| ANC/Hamas Equivalence | 4 | 4 | 3 |
| Israel-Apartheid Severance | 4 | 4 | 2 |
| False Binary/Choose Sides | 3 | 1 | 2 |
| Depo-Provera | 4 | 4 | 4 |
| IHRA vs Jerusalem Declaration | 5 | 4 | 4 |

---

# Claim records

Each record uses: `id`, `card`, `type`, `status`, `statement`, `source_requirement`, and optionally `notes`.

## 1. Shylock

- `shylock-01` — TACTIC / CONTEXT_DEPENDENT — The Shylock reference invokes a moneylender to portray Jews as inherently deceptive in commerce, predatory lenders, or naturally associated with usury. — SOURCE_REQUIRED: literary/historical sources.
- `shylock-02` — HISTORICAL — The stereotype predates Shakespeare and is connected in the draft to medieval European restrictions on Jewish landholding and guild membership and resulting occupational patterns. — SOURCE_REQUIRED: comparative historical scholarship.
- `shylock-03` — MECHANISM — A discriminatory institutional condition can help produce a social role which is subsequently cited as evidence of an alleged group character trait. — SOURCE_REQUIRED: historical scholarship.

## 2. Mossad Agent

- `mossad-agent-01` — TACTIC — A person is portrayed as a covert Israeli intelligence operative without evidence beyond Jewish identity, Israeli connections, or political position.
- `mossad-agent-02` — MECHANISM — The accusation transforms ordinary participation in debate into alleged evidence of clandestine infiltration.
- `mossad-agent-03` — HISTORICAL_ANALOGY — The draft connects this structure to older “hidden hand” accusations alleging secret Jewish influence through visible institutions. — SOURCE_REQUIRED: historical sources.

## 3. Zio Nazi

- `zio-nazi-01` — TACTIC — A direct equivalence is drawn between Nazi Germany and Israel or Zionism.
- `zio-nazi-02` — CONTEXT_DEPENDENT — Criticism of Israeli conduct can include historical analogy without necessarily constituting Holocaust inversion.
- `zio-nazi-03` — TACTIC — The draft identifies Holocaust inversion where the analogy reverses persecuted/persecutor roles or repurposes the Holocaust to erase Jewish vulnerability. — SOURCE_REQUIRED: Holocaust-memory scholarship.

## 4. World Domination

- `world-domination-01` — TACTIC — Jews or “Zionists” are said to secretly control banks, media, governments, universities, or other institutions as part of a coordinated hidden agenda.
- `world-domination-02` — HISTORICAL — The modern conspiracy tradition is connected in the draft to the forged *Protocols of the Elders of Zion*.
- `world-domination-03` — MECHANISM — The recurring structure is a hidden collective command/control explanation for institutional events. — SOURCE_REQUIRED: conspiracy-history scholarship.

## 5. Dual Loyalty

- `dual-loyalty-01` — TACTIC — Jews are said to be incapable of full civic loyalty because their primary allegiance supposedly lies with Jews, Israel, or a “Jewish agenda.”
- `dual-loyalty-02` — MECHANISM — An individual's political preference or religious connection is converted into evidence of collective disloyalty.
- `dual-loyalty-03` — CONTEXT_DEPENDENT — A genuine, evidenced individual conflict of interest is distinguishable from a blanket presumption that Jewish identity creates divided citizenship.

## 6. Blood Libel

- `blood-libel-01` — HISTORICAL — Historical blood libel accused Jews of murdering Christian children for ritual purposes.
- `blood-libel-02` — MECHANISM — The draft identifies a structural mutation in which an older accusation concerning Jewish pleasure in suffering/death is transferred to “Zionists.”
- `blood-libel-03` — CONTEXT_DEPENDENT — A documented allegation that Israeli forces killed children is not automatically blood libel; the trope is identified where the allegation becomes a collective assertion about Jews/Zionists inherently desiring or celebrating child death.

## 7. Holocaust Denial / Distortion

- `holocaust-denial-01` — DEFINITION — Holocaust denial rejects or radically minimises the Nazi genocide of European Jews.
- `holocaust-denial-02` — DEFINITION — Holocaust distortion can involve minimising scale, manipulating chronology, selective comparison, or rhetorical inversion.
- `holocaust-denial-03` — CONTEXT_DEPENDENT — A disputed analogy about Israel is not automatically Holocaust denial.
- `holocaust-denial-04` — TACTIC/FACT — The card is strongest where the historical record is falsified or deliberately inverted. — SOURCE_REQUIRED: primary historical record and scholarship.

## 8. Talmud

- `talmud-01` — TACTIC — The Talmud is treated as a single binding operational manual and isolated passages are presented as proof of hidden Jewish doctrine.
- `talmud-02` — ESTABLISHED_IN_DRAFT — The draft describes the Talmud as a large corpus preserving rabbinic argument, disagreement, and minority opinions. — SOURCE_REQUIRED: authoritative Jewish studies source.
- `talmud-03` — CONTEXT_DEPENDENT — Quotations require attention to speaker, context, surrounding argument, and later legal status.
- `talmud-04` — QUESTION — Is a quotation being presented as a binding teaching when the source records a dispute? — RESEARCH: primary text/context.

## 9. Chosen People / Master Race

- `chosen-master-01` — TACTIC — Jewish chosenness is recast as equivalent to racial supremacy.
- `chosen-master-02` — THEOLOGICAL — The draft presents chosenness as commonly framed in terms of covenant, obligation, and responsibility rather than biological superiority. — SOURCE_REQUIRED: Jewish theological sources.
- `chosen-master-03` — TACTIC — Jewish theological terminology is translated into Nazi racial categories and used as evidence that Judaism inherently teaches domination.
- `chosen-master-04` — CONTEXT_DEPENDENT — Theological discussion of chosenness is not, by itself, treated as antisemitic.

## 10. Haavara / “Blood for Goods”

- `haavara-01` — HISTORICAL — The card concerns the 1933 Haavara Agreement and later Jewish rescue negotiations, including controversy surrounding Rudolf Kastner.
- `haavara-02` — TACTIC — These events are presented in the trope as proof that Zionists or Jewish leaders collaborated with Nazism.
- `haavara-03` — HISTORICAL — The draft characterises the evidence as involving desperate and controversial rescue arrangements under Nazi persecution and competing Jewish political interests.
- `haavara-04` — CONTEXT_DEPENDENT — Haavara, the Kastner case, and later rescue negotiations should not be collapsed into one undifferentiated event. — SOURCE_REQUIRED: primary documents and historical scholarship.

## 11. Elders of Zion

- `protocols-01` — FACT — *Protocols of the Elders of Zion* is presented as a fabricated conspiracy text rather than a record of an actual Jewish organisation.
- `protocols-02` — HISTORICAL — It was assembled and circulated in the Russian Empire in the early twentieth century. — SOURCE_REQUIRED: archival/historical scholarship.
- `protocols-03` — HISTORICAL — It became an influential modern antisemitic conspiracy text. — SOURCE_REQUIRED: historical scholarship.
- `protocols-04` — EDITORIAL — The card should identify it as a forgery first and a trope second.

## 12. Jews Are Not White

- `jews-not-white-01` — TACTIC — Racial classification is used to make a predetermined political argument.
- `jews-not-white-02` — FACT/DEMOGRAPHY — Jewish populations include Ashkenazi, Sephardi, Mizrahi, Ethiopian, and other communities with different histories and social classifications. — SOURCE_REQUIRED: demographic/historical sources.
- `jews-not-white-03` — TACTIC — Categorical racial definitions flatten population diversity; the card should concern racial essentialism rather than establishing one universally correct racial category.

## 13. Goy

- `goy-01` — LINGUISTIC — *Goy* is a Hebrew word meaning “nation” and is also used in the Hebrew Bible for Israel.
- `goy-02` — PRIMARY_TEXT — Genesis 12:2 is cited in the draft as describing Abraham's descendants becoming a *goy gadol*, “great nation.” — SOURCE_REQUIRED: specified Hebrew text/translation.
- `goy-03` — LINGUISTIC — In later Jewish usage, *goy* can refer to a non-Jew.
- `goy-04` — CONTEXT_DEPENDENT — The word's biblical range makes simplistic claims about its meaning misleading; theological claims should be separated from lexical claims.

## 14. Replacement Theology

- `replacement-01` — THEOLOGY — Replacement theology/supersessionism refers to positions in which the Church is understood to supersede or fulfil Israel's covenantal role.
- `replacement-02` — CONTEXT_DEPENDENT — Different Christian traditions formulate the doctrine differently.
- `replacement-03` — CONTEXT_DEPENDENT — Applying the doctrine to Jewish claims about land, identity, or covenant can be politically consequential without necessarily constituting an antisemitic claim about Jews.
- `replacement-04` — EDITORIAL — The draft cautions against treating “Islamic replacement” as one established doctrine; Islamic traditions contain multiple positions. — SOURCE_REQUIRED: comparative theological sources.

## 15. Apartheid Collaborators

- `apartheid-collab-01` — HISTORICAL — Israel had relationships with apartheid South Africa.
- `apartheid-collab-02` — HISTORICAL — The broader record includes relationships between apartheid South Africa and multiple foreign governments and corporations.
- `apartheid-collab-03` — HISTORICAL — Jewish South Africans were prominent in the anti-apartheid movement.
- `apartheid-collab-04` — CONTESTED — Whether Israel was uniquely responsible requires a comparative evidentiary argument rather than denial of the relationship itself. — SOURCE_REQUIRED: comparative archival record.

## 16. White, European Settlers

- `white-settlers-01` — TACTIC/ESSENTIALISM — All Israeli Jews are characterised as white European settlers.
- `white-settlers-02` — FACT/DEMOGRAPHY — Israeli Jews have diverse geographic and historical origins, including communities rooted in the Middle East, North Africa, Europe, and Ethiopia. — SOURCE_REQUIRED: demographic source.
- `white-settlers-03` — EDITORIAL — Claims about proportions should only be made with a defined population and current demographic source.

## 17. Settler-Colonialism

- `settler-colonial-01` — ACADEMIC_FRAMEWORK — Settler-colonialism is used by scholars as a framework for analysing Zionism and Israel.
- `settler-colonial-02` — CONTESTED — The framework should not itself be treated as inherently antisemitic.
- `settler-colonial-03` — TACTIC — The draft identifies a rhetorical move when the framework is presented as resolving every historical question by definition.
- `settler-colonial-04` — CONTESTED — The draft identifies historical complexity potentially omitted by a single settler/indigenous binary: Jewish indigeneity, continuous Jewish presence, immigration, Arab nationalism, Ottoman rule, British administration, and the Holocaust. — SOURCE_REQUIRED: competing scholarship.

## 18. Zionist-as-Slur

- `zionist-slur-01` — LINGUISTIC — “Zionist” can function as a straightforward political descriptor; criticism of Zionism is not inherently antisemitic.
- `zionist-slur-02` — TACTIC — The card is triggered when “Zionist” substitutes for “Jew” and carries sinister collective characteristics or exclusion/dehumanisation.
- `zionist-slur-03` — CONTESTED — The draft rejects an unsupported generalisation that the term is “increasingly” a codeword and instead proposes examining whether a political label is functioning as a proxy for an ethnic/religious group.

## 19. Litmus Test / Deplatforming

- `litmus-01` — TACTIC — Assumed position on Zionism is treated as sufficient reason to exclude, boycott, deny a platform, or attack reputation without examining actual conduct or argument.
- `litmus-02` — MECHANISM — The rhetorical move is guilt by assumed affiliation.
- `litmus-03` — CASE_LINK — The draft proposes the Adam Mendelsohn/UCT dispute as a regional example and requires sourcing allegations to court records or party filings.
- `litmus-04` — SOURCE_REQUIRED — The UCT lecture itself should not be used to infer disputed subsequent statements or litigation claims; those require direct procedural sources.

## 20. Platform / Institutional Control

- `platform-control-01` — TACTIC — A “Zionist” or Jewish influence is alleged to secretly control a platform, university, donor board, government agency, or legislation.
- `platform-control-02` — MECHANISM — The relevant distinction is between documented influence by identifiable actors and a hidden collective Jewish/Zionist command structure.
- `platform-control-03` — COUNTER_TEST — Identify actual actor, evidence of influence, mechanism, and decision.
- `platform-control-04` — TACTIC — When those particulars disappear and “the Zionists” become the unexplained agent, the conspiracy structure is present.

## 21. River to Sea

- `river-sea-01` — CONTESTED — “From the river to the sea, Palestine will be free” has multiple interpretations.
- `river-sea-02` — INTERPRETATION — Supporters can use the phrase to mean Palestinian freedom and equal rights.
- `river-sea-03` — INTERPRETATION — Critics interpret it as implying elimination of Israel.
- `river-sea-04` — CONTEXT_DEPENDENT — Historical use by Palestinian movements and speaker context matter; a particular charter alone should not determine every contemporary speaker's meaning. — SOURCE_REQUIRED: historical usage + speaker-specific context.

## 22. Weaponizing Antisemitism

- `weaponizing-01` — CLAIM — Accusations of antisemitism may be deployed strategically to silence criticism of Israel.
- `weaponizing-02` — CONTESTED — The subject is legitimate to investigate but can itself become a rhetorical shield if every antisemitism allegation is automatically dismissed as bad faith.
- `weaponizing-03` — COUNTER_TEST — Examine whether the allegation is supported by content/context or invoked merely to terminate debate.

## 23. Jews Are White

- `jews-white-01` — TACTIC/ESSENTIALISM — All Jews are assigned a single “white” identity and that classification is used to settle political questions about indigeneity, power, or victimhood.
- `jews-white-02` — FACT/DEMOGRAPHY — Jewish populations have diverse histories and are classified differently across societies. — SOURCE_REQUIRED: demographic/social-classification sources.
- `jews-white-03` — MECHANISM — The rhetorical mechanism is insistence that a complex population fit one political category.

## 24. Jews Are Not Semites

- `not-semites-01` — HISTORICAL/LINGUISTIC — “Antisemitism” is presented as a nineteenth-century European political term for anti-Jewish hostility.
- `not-semites-02` — HISTORICAL — The draft attributes popularisation to Wilhelm Marr in the 1870s/1880s and states that the term was coined/popularised by antisemites rather than as a Jewish self-description. — SOURCE_REQUIRED: historical lexical sources.
- `not-semites-03` — LINGUISTIC — The modern term “antisemitism” refers specifically to hostility toward Jews; this differs from broader linguistic/historical use of “Semitic.” — SOURCE_REQUIRED: authoritative linguistic/historical source.

## 25. Cape Union Mart

- `cape-union-01` — CASE/LEGAL — The Western Cape High Court judgment in *Cape Union Mart International (Pty) Ltd and Another v Ockards and Others* is identified by the draft as dated 4 September 2026 and [2026] ZAWCHC 477. — SOURCE_REQUIRED: judgment.
- `cape-union-02` — CASE/LEGAL — The court granted a final interdict concerning specified claims associating Cape Union Mart/brands with Israel, genocide, military conflict in Gaza, or killing/complicity in killing children. — SOURCE_REQUIRED: judgment.
- `cape-union-03` — CASE/LEGAL — The judgment did not prohibit boycott activity or public protest and required compliance with the Regulation of Gatherings Act. — SOURCE_REQUIRED: judgment.
- `cape-union-04` — CASE/LEGAL — The draft says respondents failed to establish relevant factual propositions with admissible evidence sufficient for their defences. — SOURCE_REQUIRED: judgment.
- `cape-union-05` — LIVE — Appeal/leave status must be updated from the current procedural record before publication.

## 26. UCT Resolutions

- `uct-resolutions-01` — INSTITUTIONAL — UCT Council adopted resolutions in June 2024 concerning a boycott of Israel and the IHRA definition. — SOURCE_REQUIRED: actual resolutions/minutes.
- `uct-resolutions-02` — CASE_LINK — The Mendelsohn litigation challenges aspects of process and institutional governance. — SOURCE_REQUIRED: pleadings/judgment.
- `uct-resolutions-03` — EDITORIAL — The existence of the resolutions should not itself be treated as evidence of antisemitism.
- `uct-resolutions-04` — SOURCE_REQUIRED — Substantive political debate should be separated from institutional-process claims and sourced to the underlying resolutions and pleadings.

## 27. SA Jews for a Free Palestine

- `sa-jfp-01` — TACTIC — An argument from identity treats criticism of a position as incapable of being antisemitic because the speaker/organisation is Jewish.
- `sa-jfp-02` — LOGIC — Identity can be relevant context but does not logically determine whether a proposition is antisemitic.
- `sa-jfp-03` — SOURCE_REQUIRED — The card must identify exact statement, speaker, date, and procedural status rather than infer motive or make a general claim about the organisation.

## 28. Mendelsohn

- `mendelsohn-01` — CASE — The card should identify Professor Adam Mendelsohn and his UCT role. — SOURCE_REQUIRED: institutional record.
- `mendelsohn-02` — CASE — The 29 April 2026 inaugural lecture is part of the chronology. — SOURCE_REQUIRED: UCT record.
- `mendelsohn-03` — CASE — UCT resolutions form part of the chronology. — SOURCE_REQUIRED: resolutions.
- `mendelsohn-04` — LIVE — Statements/conduct complained of must be taken from the actual pleadings/affidavits rather than inferred from the lecture.
- `mendelsohn-05` — LIVE — Causes of action must be represented exactly as pleaded.
- `mendelsohn-06` — LIVE — Respondents' defence must be represented from their actual filings.
- `mendelsohn-07` — LIVE — Court/procedural history must be sourced to court records.
- `mendelsohn-08` — LIVE — The card should identify what remains unresolved as of the publication date.

## 29. Jerusalem Sovereignty

- `jerusalem-01` — HISTORICAL — Jordan controlled East Jerusalem from 1948 until 1967.
- `jerusalem-02` — HISTORICAL — Israel has exercised control over East Jerusalem since 1967.
- `jerusalem-03` — LEGAL — Historical administration, sovereignty, and present international legal status are distinct categories.
- `jerusalem-04` — CONTESTED — Competing sovereignty claims and international positions must be represented without collapsing control into sovereignty. — SOURCE_REQUIRED: primary/legal/institutional sources.

## 30. Quran / Land Claim

- `quran-land-01` — THEOLOGY — Islamic scripture contains passages concerning the Children of Israel and a blessed/holy land. — SOURCE_REQUIRED: specified verses and translation.
- `quran-land-02` — CONTESTED — Scriptural description does not by itself establish modern exclusive territorial sovereignty for Jews or Muslims.
- `quran-land-03` — THEOLOGY/LEGAL — Scriptural description and modern international sovereignty are different categories.

## 31. The “Apartheid Map”

- `apartheid-map-01` — METHODOLOGY — Popular sequences of maps should be tested against actual legal and political status at each date.
- `apartheid-map-02` — FACT — Maps can conflate land ownership, administrative control, proposed partition, armistice lines, military occupation, and sovereign annexation.
- `apartheid-map-03` — MECHANISM — The card identifies map-category errors as a source of misleading argument.
- `apartheid-map-04` — SOURCE_REQUIRED — A companion evidence map should provide dates and a legend explaining what each colour represents.

## 32. Voting Rights

- `voting-rights-01` — FACT — Israeli citizens, West Bank/Gaza residents, and Palestinian Authority voters occupy different political/legal categories relevant to voting claims.
- `voting-rights-02` — FACT — Arab citizens of Israel participate in Israeli elections.
- `voting-rights-03` — FACT — Palestinian residents of territories under Palestinian administration have a different political and legal status.
- `voting-rights-04` — CONTEXT_DEPENDENT — “Arabs cannot vote” is overbroad; the specific election and jurisdiction must be identified. — SOURCE_REQUIRED: election/legal sources.

## 33. Nakba Symmetry

- `nakba-01` — HISTORICAL — The card compares Palestinian displacement in 1947–49 with displacement/migration of Jewish populations from Arab and Muslim-majority countries during the same broad period.
- `nakba-02` — COMPARATIVE — The histories should not be implied to be identical.
- `nakba-03` — METHODOLOGY — Comparative completeness requires that one population movement not disappear when the other is used as historical evidence. — SOURCE_REQUIRED: comparative demographic/historical sources.

## 34. Balfour / Colonial Origins

- `balfour-01` — HISTORICAL — The Balfour Declaration should be placed in a wider diplomatic sequence rather than treated as a solitary act creating Israel.
- `balfour-02` — HISTORICAL — The draft identifies McMahon–Hussein correspondence, Sykes–Picot, Ottoman surrender, post-war mandates, Faisal–Weizmann, British policy, and later UN partition proposals as relevant chronology.
- `balfour-03` — CONTESTED — The historical significance of the sequence requires competing interpretations rather than a single “gotcha.”
- `balfour-04` — SOURCE_REQUIRED — The card should be a chronology of dates/documents with disputed interpretations attached to specific claims.

## 35. Palestinian Flag

- `palestinian-flag-01` — HISTORICAL — The modern Palestinian flag belongs to a broader Pan-Arab flag tradition and is historically related to the Arab Revolt flag. — SOURCE_REQUIRED: vexillological/historical source.
- `palestinian-flag-02` — INTERPRETIVE — The genealogy of the design does not by itself invalidate Palestinian national identity.
- `palestinian-flag-03` — METHODOLOGY — Distinguish origin of the design from meaning acquired through later Palestinian nationalism.

## 36. Chronology

- `chronology-01` — HISTORICAL — The First Zionist Congress took place in 1897.
- `chronology-02` — HISTORICAL — Palestinian Arab nationalism developed through overlapping late-Ottoman, Arab-nationalist, local, and post-World War I movements.
- `chronology-03` — METHODOLOGY — The stronger formulation is that competing national movements developed on different timelines, rather than asserting a simplistic single start date for Palestinian nationalism. — SOURCE_REQUIRED: historical scholarship.

## 37. ANC / Hamas Equivalence

- `anc-hamas-01` — HISTORICAL — The card distinguishes the ANC's historical relationship with the PLO/Arafat from later relationships between South African political actors and Hamas.
- `anc-hamas-02` — HISTORICAL — Mandela's 1990 statement concerning Israel's right to exist is relevant evidence.
- `anc-hamas-03` — METHODOLOGY — A 1990 statement should not be used to imply that all later ANC policy is frozen at that date.
- `anc-hamas-04` — SOURCE_REQUIRED — The card should be constructed as a timeline rather than a single quotation.

## 38. Israel–Apartheid Severance

- `israel-apartheid-01` — HISTORICAL — Israel's relationship with apartheid South Africa changed over time.
- `israel-apartheid-02` — HISTORICAL — The draft identifies the 1987 severance of remaining military ties and Shimon Peres's public denunciation of apartheid as relevant evidence. — SOURCE_REQUIRED: primary historical sources.
- `israel-apartheid-03` — HISTORICAL — Earlier Israeli-South African military and economic relationships are not erased by later severance.
- `israel-apartheid-04` — METHODOLOGY — This card should be paired with Apartheid Collaborators to present the chronology rather than select a single period.

## 39. False Binary / “Choose Sides”

- `false-binary-01` — TACTIC — An observer is required to choose one collective side and neutrality/qualification/criticism of both sides is treated as moral failure.
- `false-binary-02` — CONTEXT_DEPENDENT — Some legal or factual questions genuinely have binary answers.
- `false-binary-03` — COUNTER_TEST — Ask whether choosing a side has replaced examination of the particular claim.

## 40. Depo-Provera

- `depo-01` — FACT/ETHICS — The draft identifies disproportionate administration of Depo-Provera and informed-consent failures affecting Ethiopian-Israeli women as documented issues.
- `depo-02` — CONTESTED — Allegations of coercion must be distinguished from documented medical-ethics failures.
- `depo-03` — CONTESTED — Claims about deliberate state intent must be separated from the underlying medical-ethics evidence.
- `depo-04` — CONTESTED — Claims of a systematic genocidal programme require a separate evidentiary showing and should not be inferred from the underlying facts alone. — SOURCE_REQUIRED: primary/institutional evidence.

## 41. IHRA vs Jerusalem Declaration

- `ihra-jda-01` — INSTITUTIONAL — The IHRA Working Definition is described in the draft as a non-legally binding definition adopted by IHRA in 2016.
- `ihra-jda-02` — INSTITUTIONAL — It defines antisemitism as a certain perception of Jews that may be expressed as hatred and includes examples, several concerning Israel.
- `ihra-jda-03` — INSTITUTIONAL — The Jerusalem Declaration was developed subsequently as an alternative framework.
- `ihra-jda-04` — CONTESTED — The Jerusalem Declaration argues that the IHRA definition is unclear in important respects and proposes a different core definition/contextual guidelines.
- `ihra-jda-05` — METHODOLOGY — The existence of a competing definition does not itself establish which framework should be treated as correct; the graph should model the documented dispute over definitions, scope, examples, and institutional use.

---

# Immediate graph relationships implied by extraction

The extraction also identifies several relationship families that should be seeded separately from claims:

1. **Historical predecessor** — Shylock → World Domination → Platform Control.
2. **Mechanism similarity** — Dual Loyalty ↔ Jews Are White ↔ Jews Are Not White.
3. **Conceptual transfer** — Blood Libel → Zio Nazi / contemporary collective accusations.
4. **Evidence dependency** — Apartheid Collaborators ↔ Israel–Apartheid Severance.
5. **Case hub** — Litmus Test/Deplatforming → Mendelsohn.
6. **Definition dispute** — IHRA vs Jerusalem Declaration → Weaponizing Antisemitism.
7. **Comparative framework** — Settler-Colonialism ↔ Balfour/Colonial Origins ↔ Nakba Symmetry.
8. **Context dependency** — River to Sea → speaker/context/source.
9. **Theological reference** — Goy → Replacement Theology → Quran/Land Claim.
10. **Methodological safeguards** — Apartheid Map / Voting Rights / False Binary / Depo-Provera all reinforce the rule that a proposition must be tested at the correct factual/legal level.

## Next validation stage

The 104 claims should now be validated against:

- source availability;
- duplicate claims;
- claim-to-source coverage;
- claim-to-interpretation coverage for contested claims;
- case chronology;
- relationship directionality;
- whether a “claim” is actually better modelled as a concept, question, or reference.

Only after that validation should these records become the canonical database seed.
