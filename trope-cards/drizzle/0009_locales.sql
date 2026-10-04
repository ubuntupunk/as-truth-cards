-- Locale dimension as a first-class canonical ontology.
--
-- Card ↔ Locale is many-to-many. Locale is intrinsic metadata; Collection
-- remains mutable curation. This migration adds locale tables in the
-- trope_graph schema, matching the existing pattern (collections/card_collections,
-- mechanisms/card_mechanisms).

CREATE TABLE trope_graph.locales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE trope_graph.card_locales (
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  locale_id uuid NOT NULL REFERENCES trope_graph.locales(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, locale_id)
);
