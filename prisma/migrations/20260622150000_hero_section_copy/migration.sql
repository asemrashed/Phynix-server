-- HomepageSection was added to the schema without a prior CREATE migration.
CREATE TABLE IF NOT EXISTS "HomepageSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT,
    "description" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "ctaPrimary" JSONB,
    "ctaSecondary" JSONB,
    "metadata" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSection_key_key" ON "HomepageSection"("key");

INSERT INTO "HomepageSection" ("id", "key", "updatedAt")
VALUES ('hero-default', 'hero', NOW())
ON CONFLICT ("key") DO NOTHING;

-- Update hero section copy (eyebrow = H2, title = H1)
UPDATE "HomepageSection"
SET
  "eyebrow" = 'Professional Forex Education in Bangla & English',
  "title" = 'Master Forex Trading with Institutional-Level Education',
  "description" = 'Learn Smart Money Concepts (SMC), ICT Methodology, Risk Management, and Professional Trading Skills through structured courses, mentorship, and real-market insights designed for serious traders.',
  "updatedAt" = NOW()
WHERE "key" = 'hero';
