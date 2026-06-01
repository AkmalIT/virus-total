import { AnalysisJobType } from '@prisma/client';

export const JOB_RUNNING_TIMEOUT_MS: Record<AnalysisJobType, number> = {
  static_analysis: 30_000,
  url_scan: 60_000,
  ai_summary: 120_000,
  sandbox: 900_000,
};

export function getJobRunningTimeoutMs(jobType: AnalysisJobType) {
  return JOB_RUNNING_TIMEOUT_MS[jobType];
}

export function isRunningJobStale(
  jobType: AnalysisJobType,
  startedAt: Date,
  now = Date.now(),
) {
  return now - startedAt.getTime() > getJobRunningTimeoutMs(jobType);
}

export function getJobRecoveryIntervalMs() {
  const parsed = Number(process.env.JOB_RECOVERY_INTERVAL_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}

export function getZombiePendingThresholdMs() {
  const parsed = Number(process.env.JOB_RECOVERY_PENDING_THRESHOLD_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}
