-- Installment access suspend + reminder flags

ALTER TABLE "InstallmentAgreement" ADD COLUMN IF NOT EXISTS "accessSuspendedAt" TIMESTAMP(3);

ALTER TABLE "InstallmentPayment" ADD COLUMN IF NOT EXISTS "reminderFlags" JSONB NOT NULL DEFAULT '{}';
