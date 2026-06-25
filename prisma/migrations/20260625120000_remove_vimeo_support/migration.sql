-- Preserve any legacy Vimeo references on the videoRef column before dropping vimeoId
UPDATE "Lesson" SET "videoRef" = COALESCE("videoRef", "vimeoId") WHERE "vimeoId" IS NOT NULL;

-- Move legacy Vimeo lessons onto the default provider before removing the enum value
UPDATE "Lesson" SET "videoProvider" = 'YOUTUBE' WHERE "videoProvider" = 'VIMEO';

-- Recreate the VideoProvider enum without VIMEO
CREATE TYPE "VideoProvider_new" AS ENUM ('YOUTUBE', 'SELF_HOSTED');

ALTER TABLE "Lesson" ALTER COLUMN "videoProvider" DROP DEFAULT;
ALTER TABLE "Lesson" ALTER COLUMN "videoProvider" TYPE "VideoProvider_new" USING ("videoProvider"::text::"VideoProvider_new");
ALTER TABLE "Lesson" ALTER COLUMN "videoProvider" SET DEFAULT 'YOUTUBE';

DROP TYPE "VideoProvider";
ALTER TYPE "VideoProvider_new" RENAME TO "VideoProvider";

-- Drop the Vimeo-specific column
ALTER TABLE "Lesson" DROP COLUMN "vimeoId";
