-- CreateTable
-- User-authored decomposition/chain drafts. Participation data in `public`,
-- never ontology: no foreign key reaches the `trope_graph` schema, and the
-- referenced card is stored as a plain slug string.
CREATE TABLE "decomposition_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_slug" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decomposition_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decomposition_drafts_user_id_idx" ON "decomposition_drafts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "decomposition_drafts_user_id_card_slug_key" ON "decomposition_drafts"("user_id", "card_slug");

-- AddForeignKey
ALTER TABLE "decomposition_drafts" ADD CONSTRAINT "decomposition_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
