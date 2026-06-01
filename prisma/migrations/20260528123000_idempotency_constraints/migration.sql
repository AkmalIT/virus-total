-- Make deduplication and worker idempotency enforceable under concurrency.

DROP INDEX IF EXISTS "submissions_sha256_key";

CREATE UNIQUE INDEX "submissions_type_sha256_key"
  ON "submissions"("type", "sha256");

CREATE UNIQUE INDEX "analysis_jobs_submission_id_job_type_key"
  ON "analysis_jobs"("submission_id", "job_type");

CREATE UNIQUE INDEX "analysis_results_job_id_result_type_key"
  ON "analysis_results"("job_id", "result_type");
