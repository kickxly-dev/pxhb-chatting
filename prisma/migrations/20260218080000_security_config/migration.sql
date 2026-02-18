-- CreateTable
CREATE TABLE "SecurityConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "allowedOrigins" TEXT[] NOT NULL,
    "cspEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityConfig_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "SecurityConfig" ("id", "allowedOrigins", "cspEnabled", "updatedAt")
VALUES ('default', ARRAY[]::TEXT[], true, NOW())
ON CONFLICT ("id") DO NOTHING;
