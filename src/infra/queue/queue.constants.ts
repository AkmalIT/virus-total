import { AnalysisJobType } from '@prisma/client';

export const ANALYSIS_QUEUE = 'analysis';
export const ANALYSIS_DLQ = 'analysis-dead-letter';

export const ANALYSIS_JOB_NAMES = {
  static: 'static-analysis',
  url: 'url-scan',
  ai: 'ai-summary',
  sandbox: 'sandbox',
} as const;

export type AnalysisQueueJobName =
  (typeof ANALYSIS_JOB_NAMES)[keyof typeof ANALYSIS_JOB_NAMES];

export type AnalysisJobPayload = {
  jobId: string;
  submissionId: string;
  jobType: AnalysisJobType;
};

export type AnalysisDeadLetterPayload = AnalysisJobPayload & {
  reason: string;
  failedAt: string;
};

export function queueJobNameForJobType(
  jobType: AnalysisJobType,
): AnalysisQueueJobName {
  if (jobType === AnalysisJobType.static_analysis) {
    return ANALYSIS_JOB_NAMES.static;
  }

  if (jobType === AnalysisJobType.ai_summary) {
    return ANALYSIS_JOB_NAMES.ai;
  }

  if (jobType === AnalysisJobType.sandbox) {
    return ANALYSIS_JOB_NAMES.sandbox;
  }

  return ANALYSIS_JOB_NAMES.url;
}
