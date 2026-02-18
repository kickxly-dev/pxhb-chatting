-- Add Server.iconUrl for server icons

ALTER TABLE "Server" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
