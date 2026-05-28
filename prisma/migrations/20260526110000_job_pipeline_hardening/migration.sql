-- Add the full durable job state machine.
ALTER TABLE "analysis_jobs" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "AnalysisJobStatus_new" AS ENUM (
  'pending',
  'queued',
  'running',
  'completed',
  'failed'
);

ALTER TABLE "analysis_jobs"
  ALTER COLUMN "status" TYPE "AnalysisJobStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'done' THEN 'completed'
      ELSE "status"::text
    END
  )::"AnalysisJobStatus_new";

DROP TYPE "AnalysisJobStatus";
ALTER TYPE "AnalysisJobStatus_new" RENAME TO "AnalysisJobStatus";

ALTER TABLE "analysis_jobs"
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- Persist queue/retry metadata in Postgres. Redis remains transport only.
ALTER TABLE "analysis_jobs"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" TEXT,
  ADD COLUMN "queued_at" TIMESTAMP(3);

-- A submission should not get duplicate jobs for the same engine.
CREATE UNIQUE INDEX "analysis_jobs_submission_id_engine_key"
  ON "analysis_jobs"("submission_id", "engine");

-- A job writes one durable result. This is the idempotency marker for retries.
CREATE UNIQUE INDEX "analysis_results_job_id_key"
  ON "analysis_results"("job_id");

-- Worker-produced IOCs are inserted idempotently.
CREATE UNIQUE INDEX "iocs_submission_id_type_value_key"
  ON "iocs"("submission_id", "type", "value");
