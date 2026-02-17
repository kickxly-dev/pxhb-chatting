ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "DmMessage" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "DmMessage" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Message_deletedAt_idx" ON "Message"("deletedAt");
CREATE INDEX "DmMessage_deletedAt_idx" ON "DmMessage"("deletedAt");
