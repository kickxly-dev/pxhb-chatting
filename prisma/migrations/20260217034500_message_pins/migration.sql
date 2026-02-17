ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "pinnedById" TEXT;

ALTER TABLE "DmMessage" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "DmMessage" ADD COLUMN "pinnedById" TEXT;

CREATE INDEX "Message_pinnedAt_idx" ON "Message"("pinnedAt");
CREATE INDEX "DmMessage_pinnedAt_idx" ON "DmMessage"("pinnedAt");
