-- Align the durable schema with the final submission -> jobs -> results ERD.

-- Users: OAuth subject naming, nullable local passwords, role as varchar, timestamps.
DROP INDEX IF EXISTS "users_oauth_provider_oauth_id_key";

ALTER TABLE "users"
  RENAME COLUMN "oauth_id" TO "oauth_subject";

ALTER TABLE "users"
  ALTER COLUMN "email" TYPE VARCHAR(320),
  ALTER COLUMN "username" TYPE VARCHAR(100),
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ALTER COLUMN "password_hash" TYPE TEXT;

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE VARCHAR(50) USING "role"::text,
  ALTER COLUMN "role" SET DEFAULT 'user';

ALTER TABLE "users"
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

DROP TYPE IF EXISTS "UserRole";

CREATE INDEX "users_oauth_provider_oauth_subject_idx"
  ON "users"("oauth_provider", "oauth_subject");

-- Submissions: final file metadata names, status value, dedupe hash, storage key.
ALTER TABLE "submissions"
  ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "SubmissionStatus_new" AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed'
);

ALTER TABLE "submissions"
  ALTER COLUMN "status" TYPE "SubmissionStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'done' THEN 'completed'
      ELSE "status"::text
    END
  )::"SubmissionStatus_new";

DROP TYPE "SubmissionStatus";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";

ALTER TABLE "submissions"
  ALTER COLUMN "status" SET DEFAULT 'queued';

ALTER TABLE "submissions"
  RENAME COLUMN "original_filename" TO "file_name";

ALTER TABLE "submissions"
  RENAME COLUMN "file_hash" TO "sha256";

ALTER TABLE "submissions"
  ADD COLUMN "storage_key" TEXT;

UPDATE "submissions"
SET "storage_key" = "url",
    "url" = NULL
WHERE "type"::text = 'file'
  AND "storage_key" IS NULL;

ALTER TABLE "submissions"
  ALTER COLUMN "file_name" TYPE TEXT,
  ALTER COLUMN "mime_type" TYPE TEXT,
  ALTER COLUMN "sha256" TYPE VARCHAR(64),
  ALTER COLUMN "url" TYPE TEXT,
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

CREATE UNIQUE INDEX "submissions_sha256_key" ON "submissions"("sha256");
CREATE INDEX "submissions_created_at_idx" ON "submissions"("created_at" DESC);

-- Jobs: final job_type enum, error naming, created_at, ERD indexes.
DROP INDEX IF EXISTS "analysis_jobs_submission_id_engine_key";
DROP INDEX IF EXISTS "analysis_jobs_priority_idx";

ALTER TABLE "analysis_jobs"
  RENAME COLUMN "engine" TO "job_type";

CREATE TYPE "AnalysisJobType" AS ENUM (
  'static_analysis',
  'url_scan',
  'ai_summary',
  'sandbox'
);

ALTER TABLE "analysis_jobs"
  ALTER COLUMN "job_type" TYPE "AnalysisJobType"
  USING (
    CASE
      WHEN "job_type"::text = 'static' THEN 'static_analysis'
      WHEN "job_type"::text = 'dynamic' THEN 'sandbox'
      WHEN "job_type"::text = 'ai' THEN 'ai_summary'
      ELSE 'url_scan'
    END
  )::"AnalysisJobType";

DROP TYPE "AnalysisEngine";

ALTER TABLE "analysis_jobs"
  RENAME COLUMN "last_error" TO "error_message";

ALTER TABLE "analysis_jobs"
  DROP COLUMN "queued_at",
  ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "priority" SET DEFAULT 1,
  ALTER COLUMN "started_at" TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "finished_at" TYPE TIMESTAMPTZ(3) USING "finished_at" AT TIME ZONE 'UTC';

CREATE INDEX "analysis_jobs_job_type_idx" ON "analysis_jobs"("job_type");

-- Results: final result_type enum and JSONB GIN search index.
DROP INDEX IF EXISTS "analysis_results_job_id_key";
DROP INDEX IF EXISTS "analysis_results_severity_idx";

ALTER TABLE "analysis_results"
  RENAME COLUMN "type" TO "result_type";

CREATE TYPE "AnalysisResultType_new" AS ENUM (
  'static_report',
  'sandbox_report',
  'ai_summary',
  'reputation'
);

ALTER TABLE "analysis_results"
  ALTER COLUMN "result_type" TYPE "AnalysisResultType_new"
  USING (
    CASE
      WHEN "result_type"::text IN ('malware_score', 'ioc', 'signature_match') THEN 'static_report'
      WHEN "result_type"::text = 'behavior' THEN 'sandbox_report'
      ELSE 'ai_summary'
    END
  )::"AnalysisResultType_new";

DROP TYPE "AnalysisResultType";
ALTER TYPE "AnalysisResultType_new" RENAME TO "AnalysisResultType";

ALTER TYPE "Severity" ADD VALUE IF NOT EXISTS 'info' BEFORE 'low';

ALTER TABLE "analysis_results"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

CREATE INDEX "analysis_results_data_idx"
  ON "analysis_results" USING GIN ("data");

-- IOCs: final enum, confidence score, and lookup indexes.
DROP INDEX IF EXISTS "iocs_submission_id_type_value_key";

CREATE TYPE "IocType_new" AS ENUM (
  'ip',
  'domain',
  'url',
  'hash',
  'email'
);

ALTER TABLE "iocs"
  ALTER COLUMN "type" TYPE "IocType_new"
  USING (
    CASE
      WHEN "type"::text = 'registry_key' THEN 'hash'
      ELSE "type"::text
    END
  )::"IocType_new";

DROP TYPE "IocType";
ALTER TYPE "IocType_new" RENAME TO "IocType";

ALTER TABLE "iocs"
  DROP COLUMN "context",
  ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "iocs"
  ALTER COLUMN "confidence" DROP DEFAULT;

CREATE INDEX "iocs_value_idx" ON "iocs"("value");
