-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "destination" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "countryName" TEXT,
    "postalCode" TEXT,
    "currency" TEXT,
    "baseCurrency" TEXT,
    "baseAmount" REAL,
    "fxRate" REAL,
    "displayAmount" REAL,
    "fxFetchedAt" DATETIME,
    "productSlug" TEXT,
    "structureId" TEXT,
    "quantity" TEXT,
    "dimensions" TEXT,
    "board" TEXT,
    "finishing" TEXT,
    "foil" TEXT,
    "printing" TEXT,
    "deliveryRequirements" TEXT,
    "message" TEXT,
    "payload" TEXT,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "storedAs" TEXT NOT NULL,
    "structureId" TEXT,
    "panelId" TEXT,
    "panelLabel" TEXT,
    "panelWidthMm" REAL,
    "panelHeightMm" REAL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "colour" TEXT,
    "effectiveDpi" REAL,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "findings" TEXT,
    "meta" TEXT,
    "leadId" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'live',
    "provider" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "destinations" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'quote-only',
    "currency" TEXT,
    "note" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "product_markets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSlug" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "note" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "production_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "leadId" TEXT,
    "quoteRef" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "productSlug" TEXT,
    "productName" TEXT,
    "dimensions" TEXT,
    "material" TEXT,
    "boardGrade" TEXT,
    "quantity" INTEGER,
    "finishes" TEXT,
    "printSpec" TEXT,
    "destination" TEXT,
    "destinationCountry" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'quote-accepted',
    "status" TEXT NOT NULL DEFAULT 'open',
    "specsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "specsConfirmedBy" TEXT,
    "specsConfirmedAt" DATETIME,
    "artworkApproved" BOOLEAN NOT NULL DEFAULT false,
    "artworkApprovedBy" TEXT,
    "artworkApprovedAt" DATETIME,
    "productionReady" BOOLEAN NOT NULL DEFAULT false,
    "productionReadyAt" DATETIME,
    "blockedReason" TEXT,
    "dispatchCarrier" TEXT,
    "dispatchTracking" TEXT,
    "dispatchedAt" DATETIME,
    "deliveredAt" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "production_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artwork_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "reference" TEXT,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storedAs" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prepressReady" BOOLEAN NOT NULL DEFAULT false,
    "prepressErrors" INTEGER NOT NULL DEFAULT 0,
    "prepressWarnings" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artwork_versions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "production_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "checkName" TEXT,
    "notes" TEXT,
    "actor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quality_checks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "production_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "leads_kind_status_idx" ON "leads"("kind", "status");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "artwork_created_at_idx" ON "artwork"("created_at");

-- CreateIndex
CREATE INDEX "exchange_rates_base_quote_fetchedAt_idx" ON "exchange_rates"("base", "quote", "fetchedAt");

-- CreateIndex
CREATE INDEX "product_markets_productSlug_country_idx" ON "product_markets"("productSlug", "country");

-- CreateIndex
CREATE INDEX "production_jobs_stage_status_idx" ON "production_jobs"("stage", "status");

-- CreateIndex
CREATE INDEX "production_jobs_customerEmail_idx" ON "production_jobs"("customerEmail");

-- CreateIndex
CREATE INDEX "job_events_jobId_created_at_idx" ON "job_events"("jobId", "created_at");

-- CreateIndex
CREATE INDEX "artwork_versions_jobId_version_idx" ON "artwork_versions"("jobId", "version");

-- CreateIndex
CREATE INDEX "quality_checks_jobId_kind_idx" ON "quality_checks"("jobId", "kind");

