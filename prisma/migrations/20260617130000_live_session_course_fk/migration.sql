-- Add FK from LiveSession.courseId to Course (relation used by session hub queries)
ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
