# VirusTotal Backend

NestJS backend for asynchronous malware and URL analysis.

## Core ERD

```text
users
  -> submissions
      -> analysis_jobs
          -> analysis_results

submissions
  -> iocs
```

## Tables

`users`
- `id uuid PK`
- `email varchar UNIQUE`
- `username varchar UNIQUE`
- `password_hash text nullable`
- `oauth_provider varchar nullable`
- `oauth_subject varchar nullable`
- `role varchar`
- `created_at timestamptz`
- `updated_at timestamptz`
- indexes: `email`, `username`, `(oauth_provider, oauth_subject)`

`submissions`
- `id uuid PK`
- `user_id uuid FK -> users.id`
- `type`: `file | url | domain | hash`
- `status`: `accepted | processing | completed | failed`
- `file_name`, `mime_type`, `size_bytes`, `sha256`, `storage_key`, `url`
- `created_at timestamptz`
- `updated_at timestamptz`
- indexes: `user_id`, `status`, `created_at DESC`, `UNIQUE(type, sha256)`

`analysis_jobs`
- `id uuid PK`
- `submission_id uuid FK -> submissions.id`
- `job_type`: `static_analysis | url_scan | ai_summary | sandbox`
- `status`: `pending | queued | running | completed | failed`
- `attempts`, `priority`, `started_at`, `finished_at`, `error_message`, `created_at`
- indexes: `submission_id`, `status`, `job_type`, `UNIQUE(submission_id, job_type)`

`analysis_results`
- `id uuid PK`
- `job_id uuid FK -> analysis_jobs.id`
- `severity`: `info | low | medium | high | critical`
- `score float nullable`
- `result_type`: `static_report | sandbox_report | ai_summary | reputation`
- `data jsonb`
- `created_at timestamptz`
- indexes: `job_id`, `GIN(data)`, `UNIQUE(job_id, result_type)`

`iocs`
- `id uuid PK`
- `submission_id uuid FK -> submissions.id`
- `type`: `ip | domain | url | hash | email`
- `value text`
- `confidence float`
- `created_at timestamptz`
- indexes: `submission_id`, `type`, `value`

## Implementation Phases

1. Foundation: auth, users, PostgreSQL, config, Redis, Swagger.
2. Core domain: submissions, jobs, results.
3. Async system: BullMQ, workers, retries, websocket gateway.
4. Real features: static analysis, URL scan, AI explanation.
5. Scale: Elasticsearch, caching, metrics, observability.

## Queue

Main queue: `analysis`.
Dead-letter queue: `analysis-dead-letter`.

Jobs are enqueued with:
- `attempts: 3`
- exponential backoff with `delay: 2000`
- `removeOnComplete: 100`
- `removeOnFail: 500`

Worker payload:

```json
{
  "jobId": "uuid",
  "submissionId": "uuid",
  "jobType": "static_analysis"
}
```

Outbox-lite:

- `pending` = job persisted in DB, not yet in Redis
- `queued` = BullMQ enqueue succeeded
- submission `accepted` = DB commit ok, jobs not yet in Redis
- submission `processing` = at least one job is `queued` or `running`
- enqueue failure after DB commit leaves jobs `pending` and submission `accepted`
- recovery poll interval: `JOB_RECOVERY_INTERVAL_MS` (default `30000`)
- zombie threshold: `JOB_RECOVERY_PENDING_THRESHOLD_MS` (default `30000`)
- running timeout is per job type (see `src/modules/jobs/job-timeouts.ts`)
- manual recovery: `POST /jobs/queue/recover`

File upload (streaming):

```text
POST /submissions/file/upload
Content-Type: multipart/form-data

fields:
  user_id
file:
  artifact binary stream
```

Upload path streams bytes once through SHA-256 and MinIO. Required env:

```text
MINIO_ENDPOINT
MINIO_PORT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
MINIO_USE_SSL=false
```

Dead-letter inspection:

```text
GET /jobs/queue/dead-letter
GET /jobs/dlq
POST /jobs/queue/dead-letter/:id/retry
POST /jobs/dlq/:id/retry
```

Response shape:

```json
{
  "id": "bull-dlq-id",
  "jobId": "uuid",
  "submissionId": "uuid",
  "jobType": "static_analysis",
  "attempts": 3,
  "failedReason": "worker error",
  "failedAt": "2026-05-31T12:00:00.000Z",
  "payload": {}
}
```

Structured logs include `requestId`, `submissionId`, `jobId`, `eventType`, and `durationMs` when available. Pass `X-Request-Id` to correlate HTTP requests end-to-end.

## Websocket

Gateway namespace: `/analysis-stream`

Subscribe event:

```text
analysis.subscribe
```

Update event:

```text
analysis.update
```

Event payload:

```json
{
  "submissionId": "uuid",
  "jobType": "sandbox",
  "status": "running"
}
```

## Sandbox Rule

Never execute uploaded files on the host machine.

Sandbox execution must happen in an isolated container with:
- no network
- read-only filesystem
- CPU limit
- memory limit
- timeout kill
- destroy container after collection

Expected sandbox result shape:

```json
{
  "processes": [],
  "networkCalls": [],
  "suspiciousApis": [],
  "riskScore": 82
}
```

## Commands

```bash
npm run build
npm test
npm run start:dev
npm run start:worker
```
