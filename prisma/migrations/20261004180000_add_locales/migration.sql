-- CreateTable
CREATE TABLE "locales" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_locales" (
    "card_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,

    CONSTRAINT "card_locales_pkey" PRIMARY KEY ("card_id","locale_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locales_slug_key" ON "locales"("slug");

-- CreateIndex
CREATE INDEX "card_locales_locale_id_idx" ON "card_locales"("locale_id");

-- AddForeignKey
ALTER TABLE "card_locales" ADD CONSTRAINT "card_locales_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_locales" ADD CONSTRAINT "card_locales_locale_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed South Africa locale
INSERT INTO "locales" ("slug", "name", "description")
VALUES ('south-africa', 'South Africa', 'Regional cases and institutional disputes in South Africa')
ON CONFLICT ("slug") DO NOTHING;
