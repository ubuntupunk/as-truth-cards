-- CreateTable
-- Account profile photos. The image bytes live in a dedicated row (never on
-- `user`) so session reads never carry them; `user.image` stores only the
-- public URL of the route that serves these bytes (`GET /api/users/:id/avatar`).
-- One row per user — re-upload is an upsert — and the key cascades with the
-- account, so an avatar can never outlive its owner.
CREATE TABLE "user_avatars" (
    "user_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
