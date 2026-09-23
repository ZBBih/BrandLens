-- Ownership, durable rate limiting, job heartbeats, and removal of write-only columns.
--
-- Every dropped Report column was a denormalised copy of a field that also lives
-- inside the "data" JSON blob, or belonged to the removed email feature, so no
-- report content is lost.

-- Failed and in-flight jobs never received a slug; give them one before the
-- column becomes NOT NULL.
UPDATE "Report" SET "slug" = 'report-' || replace(gen_random_uuid()::text, '-', '') WHERE "slug" IS NULL;

-- DropIndex
DROP INDEX "Report_domain_createdAt_idx";

-- DropIndex (duplicate of the unique index Report_slug_key)
DROP INDEX "Report_slug_idx";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "aiInsights",
DROP COLUMN "assetsGeneratedAt",
DROP COLUMN "cached",
DROP COLUMN "consistencyBreakdown",
DROP COLUMN "consistencyGrade",
DROP COLUMN "consistencyIssues",
DROP COLUMN "consistencyScore",
DROP COLUMN "emailSentAt",
DROP COLUMN "emailSentTo",
DROP COLUMN "generatedAssets",
DROP COLUMN "isDemo",
DROP COLUMN "tempPublicUntil",
ADD COLUMN     "heartbeatAt" TIMESTAMP(3),
ADD COLUMN     "overrides" TEXT,
ADD COLUMN     "ownerTokenHash" TEXT,
ADD COLUMN     "sourceReportId" TEXT,
ALTER COLUMN "slug" SET NOT NULL;

-- Jobs that were mid-flight when this migration runs can never finish.
UPDATE "Report" SET "status" = 'failed', "error" = 'This analysis was interrupted by a server update. Please run it again.'
WHERE "status" NOT IN ('completed', 'failed');

-- DropTable (removed email feature)
DROP TABLE "EmailSubscriber";

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key","day")
);

-- CreateIndex
CREATE INDEX "Report_domain_status_createdAt_idx" ON "Report"("domain", "status", "createdAt");
