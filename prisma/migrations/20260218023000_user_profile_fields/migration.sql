-- Add User.displayName and User.avatarUrl for profile customization

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
