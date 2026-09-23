-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" TEXT,
    "data" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "consistencyScore" INTEGER,
    "consistencyGrade" TEXT,
    "consistencyBreakdown" TEXT,
    "consistencyIssues" TEXT,
    "generatedAssets" TEXT,
    "assetsGeneratedAt" TIMESTAMP(3),
    "assetsRegenerateCount" INTEGER NOT NULL DEFAULT 0,
    "aiInsights" TEXT,
    "slug" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicViews" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "emailSentTo" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "tempPublicUntil" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_slug_key" ON "Report"("slug");

-- CreateIndex
CREATE INDEX "Report_domain_createdAt_idx" ON "Report"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "Report_slug_idx" ON "Report"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscriber_email_key" ON "EmailSubscriber"("email");

