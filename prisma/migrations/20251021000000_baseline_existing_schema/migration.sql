-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ANONYMOUS', 'VERIFIED', 'ACADEMIC', 'RESEARCHER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'SHARE', 'RATING_UP', 'RATING_DOWN', 'STRUCTURED_FEEDBACK', 'ACADEMIC_FEEDBACK', 'MODERATION_ACTION');

-- CreateTable
CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "front_description" TEXT NOT NULL,
    "back_description" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "image_url" TEXT,
    "tags" TEXT[],
    "included_in_palestine_stack" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sources" JSONB,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANONYMOUS',
    "bio" TEXT,
    "website" TEXT,
    "location" TEXT,
    "avatar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "card_id" INTEGER NOT NULL,
    "interactionType" "InteractionType" NOT NULL,
    "feedbackRating" INTEGER,
    "feedbackText" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "ipAddress" TEXT,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_interactions_status_created_at_idx" ON "user_interactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "user_interactions_user_id_interactionType_idx" ON "user_interactions"("user_id", "interactionType");

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

