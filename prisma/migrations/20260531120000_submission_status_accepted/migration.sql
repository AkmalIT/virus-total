CREATE TYPE "SubmissionStatus_new" AS ENUM ('accepted', 'processing', 'completed', 'failed');

ALTER TABLE "submissions" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "submissions"
ALTER COLUMN "status" TYPE "SubmissionStatus_new"
USING (
  CASE "status"::text
    WHEN 'queued' THEN 'accepted'::"SubmissionStatus_new"
    ELSE "status"::text::"SubmissionStatus_new"
  END
);

DROP TYPE "SubmissionStatus";

ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";

ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'accepted';
