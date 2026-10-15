-- AlterTable
-- Account-level onboarding completion. Nullable with no default, so existing
-- rows read as "not yet completed" and no backfill is required. Set once by the
-- authenticated server endpoint (POST /api/account/onboarding/complete).
ALTER TABLE "user" ADD COLUMN "onboarded_at" TIMESTAMP(3);
