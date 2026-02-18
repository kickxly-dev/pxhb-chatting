-- Drop SiteConfig table (lockdown system removed)

ALTER TABLE IF EXISTS "SiteConfig" DROP CONSTRAINT IF EXISTS "SiteConfig_updatedById_fkey";
DROP TABLE IF EXISTS "SiteConfig";
