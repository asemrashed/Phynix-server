-- MentorBooking: consultation type + reminder/meeting fields

CREATE TYPE "ConsultationType" AS ENUM ('CAREER', 'STUDY_ABROAD', 'TRADING', 'BUSINESS');

ALTER TABLE "MentorBooking" ADD COLUMN IF NOT EXISTS "meetingExternalId" TEXT;
ALTER TABLE "MentorBooking" ADD COLUMN IF NOT EXISTS "consultationType" "ConsultationType";
ALTER TABLE "MentorBooking" ADD COLUMN IF NOT EXISTS "reminderFlags" JSONB NOT NULL DEFAULT '{}';
