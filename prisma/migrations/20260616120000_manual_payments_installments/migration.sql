-- Manual payments + installments schema changes
-- Applied via `prisma db push` on 2026-06-16

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_VERIFICATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "referenceCode" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "senderNumber" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "customerTrxId" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_referenceCode_key" ON "PaymentRecord"("referenceCode");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_customerTrxId_key" ON "PaymentRecord"("customerTrxId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_status_createdAt_idx" ON "PaymentRecord"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ManualPaymentMethod" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "merchantNumber" TEXT NOT NULL DEFAULT '',
  "merchantName" TEXT,
  "qrImageUrl" TEXT,
  "instructions" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "InstallmentAgreementStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED');
CREATE TYPE "InstallmentPaymentStatus" AS ENUM ('PENDING', 'AWAITING_VERIFICATION', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "InstallmentPlan" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "installmentCount" INTEGER NOT NULL,
  "intervalDays" INTEGER NOT NULL DEFAULT 30,
  "downPaymentPercent" INTEGER NOT NULL DEFAULT 33,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstallmentAgreement" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" "InstallmentAgreementStatus" NOT NULL DEFAULT 'ACTIVE',
  "nextDueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstallmentAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstallmentPayment" (
  "id" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "installmentNo" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "InstallmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentRecordId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstallmentPayment_pkey" PRIMARY KEY ("id")
);
