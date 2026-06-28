-- AlterTable
ALTER TABLE "CourseReview" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- Existing reviews were already public; keep them visible on the homepage.
UPDATE "CourseReview" SET "isPublished" = true;
