-- Reassign legacy staff roles before removing enum values
UPDATE "User" SET role = 'STUDENT' WHERE role IN ('MENTOR', 'SUPPORT_AGENT');

-- PostgreSQL: replace Role enum without MENTOR / SUPPORT_AGENT
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT');

ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN role TYPE "Role_new" USING (role::text::"Role_new");
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'STUDENT';

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
