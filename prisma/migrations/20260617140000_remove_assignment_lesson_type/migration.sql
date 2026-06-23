-- Convert legacy assignment lessons to reading lessons before removing enum value
UPDATE "Lesson" SET type = 'TEXT' WHERE type = 'ASSIGNMENT';

CREATE TYPE "LessonType_new" AS ENUM ('VIDEO', 'TEXT', 'QUIZ');

ALTER TABLE "Lesson" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Lesson" ALTER COLUMN "type" TYPE "LessonType_new" USING ("type"::text::"LessonType_new");
ALTER TABLE "Lesson" ALTER COLUMN "type" SET DEFAULT 'VIDEO';

DROP TYPE "LessonType";
ALTER TYPE "LessonType_new" RENAME TO "LessonType";
