CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'IDLE', 'OFFLINE');

ALTER TABLE "User" ADD COLUMN "presenceStatus" "PresenceStatus" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "User_presenceStatus_idx" ON "User"("presenceStatus");
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");
