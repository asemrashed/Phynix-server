-- Student IDs are only valid when the account has at least one course enrollment.
-- Run `bun run db:backfill-student-ids` after migrate to issue IDs for enrolled students missing one.

UPDATE "Student" AS s
SET "uniqueStudentId" = NULL
WHERE s."uniqueStudentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Enrollment" AS e WHERE e."studentId" = s.id
  );
