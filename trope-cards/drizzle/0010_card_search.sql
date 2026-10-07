-- Card full-text and trigram search (Slice 1 of the shared card discovery primitive, issue #8).
--
-- Two mechanisms, deliberately combined rather than a single ILIKE substring:
--   1. A weighted generated tsvector column (`search_vector`) with a GIN index, for ranked
--      phrase queries via `websearch_to_tsquery` + `ts_rank_cd`.
--   2. Trigram GIN indexes on `title` and `slug`, for partial-word / fuzzy typeahead
--      ("Zionism" must surface "Zionist-as-Slur"; "Khaz" must surface "Khazar").
--
-- Weights follow issue #8: title (A), slug with hyphens as spaces (B),
-- core_question + summary (C), mechanism_summary (D).
--
-- `english` is chosen over `simple`: this is an English editorial prose corpus, so stemming
-- and stop-word handling improve recall ("blood libel", "Zionists") without harming exact
-- matches. The trigram layer covers the fuzzy and prefix cases no stemming config can reach.
-- `unaccent` is installed for a future accent-folding pass but deliberately NOT wired into the
-- v1 expression: keeping the generated column and the search query in lockstep matters more
-- than folding the corpus's rare accents today.
--
-- Manual migration (Render free tier runs no pre-deploy command, so this must be applied
-- against production before the code deploys):
--   pnpm run trope-graph:migrate -- --allow-remote
--   (never --reset)

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE trope_graph.cards
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', replace(coalesce(slug, ''), '-', ' ')), 'B') ||
      setweight(to_tsvector('english', coalesce(core_question, '') || ' ' || coalesce(summary, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(mechanism_summary, '')), 'D')
    ) STORED;

CREATE INDEX cards_search_vector_gin_idx
  ON trope_graph.cards USING gin (search_vector);

CREATE INDEX cards_title_trgm_idx
  ON trope_graph.cards USING gin (title gin_trgm_ops);

CREATE INDEX cards_slug_trgm_idx
  ON trope_graph.cards USING gin (slug gin_trgm_ops);
