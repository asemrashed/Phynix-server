-- Search performance: trigram GIN indexes for ILIKE / contains queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Course_title_trgm_idx" ON "Course" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Course_description_trgm_idx" ON "Course" USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "BlogPost_title_trgm_idx" ON "BlogPost" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "BlogPost_excerpt_trgm_idx" ON "BlogPost" USING gin (excerpt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "DigitalProduct_title_trgm_idx" ON "DigitalProduct" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PhysicalProduct_name_trgm_idx" ON "PhysicalProduct" USING gin (name gin_trgm_ops);
