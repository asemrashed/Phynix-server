-- AlterTable
ALTER TABLE "Course" ADD COLUMN "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[];
