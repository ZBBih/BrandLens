-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" TEXT,
    "data" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "Report_domain_createdAt_idx" ON "Report"("domain", "createdAt");
