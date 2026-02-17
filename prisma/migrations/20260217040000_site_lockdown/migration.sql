-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockdownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lockdownMessage" TEXT NOT NULL DEFAULT 'The site is temporarily locked down.',
    "updatedById" TEXT,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton row
INSERT INTO "SiteConfig" ("id", "updatedAt") VALUES ('site', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
