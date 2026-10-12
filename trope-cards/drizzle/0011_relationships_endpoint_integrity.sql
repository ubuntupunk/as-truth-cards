-- B3 decided (`as-truth-cards-o1t`, §11 Q5): `relationships` stays polymorphic.
--
-- The table has free-text `from_entity_type` / `to_entity_type` and unconstrained uuid
-- endpoints with no foreign keys, and the decision is NOT to harden the schema: the v1
-- projection trusts a row only when both discriminators are exactly `CARD` and both uuids
-- resolve to cards, and it surfaces every other row in `meta.warnings[]`. This migration
-- therefore adds no constraint. It only removes rows that are *provably* dead — a row that
-- declares a `CARD` endpoint whose uuid exists in no card.
--
-- Deliberately NOT deleted here:
--   - rows whose entity types are not `CARD`: the projection drops them with a warning, but
--     they are the table's type-expansion path, not corruption;
--   - rows whose non-CARD endpoint cannot be checked: there is no target table to verify
--     against, so a future type must bring its own integrity story.
--
-- On the seeded corpus this matches nothing (the seed resolves every endpoint through
-- `requireCard`), so it is an idempotent no-op that guards the next manual insert.

DELETE FROM trope_graph.relationships r
 WHERE (r.from_entity_type = 'CARD'
        AND NOT EXISTS (SELECT 1 FROM trope_graph.cards c WHERE c.id = r.from_entity_id))
    OR (r.to_entity_type = 'CARD'
        AND NOT EXISTS (SELECT 1 FROM trope_graph.cards c WHERE c.id = r.to_entity_id));