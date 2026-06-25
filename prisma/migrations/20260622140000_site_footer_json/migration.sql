-- SiteSettings was added to the schema without a prior CREATE migration.
CREATE TABLE IF NOT EXISTS "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@phynixeducation.com',
    "officeAddress" JSONB NOT NULL DEFAULT '{"line1":"128 City Road","line2":"London, EC1V 2NX"}',
    "officeHours" TEXT NOT NULL DEFAULT 'Mon–Sat, 10:00 AM – 6:00 PM (BDT)',
    "whatsappNumber" TEXT,
    "contactFaq" JSONB NOT NULL DEFAULT '[]',
    "contactPage" JSONB NOT NULL DEFAULT '{}',
    "consultationPage" JSONB NOT NULL DEFAULT '{}',
    "footerTagline" TEXT NOT NULL DEFAULT 'Premium Forex education platform for traders in Bangladesh and worldwide. Learn professional trading with live classes, mentor support, and verified certificates.',
    "footer" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "footer" JSONB NOT NULL DEFAULT '{}';
