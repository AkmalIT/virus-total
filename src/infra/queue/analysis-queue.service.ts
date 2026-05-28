import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ANALYSIS_DLQ,
  ANALYSIS_QUEUE,
  AnalysisDeadLetterPayload,
  AnalysisJobPayload,
  queueJobNameForJobType,
} from './queue.constants';

@Injectable()
export class AnalysisQueueService {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE)
    private readonly queue: Queue<AnalysisJobPayload>,
    @InjectQueue(ANALYSIS_DLQ)
    private readonly deadLetterQueue: Queue<AnalysisDeadLetterPayload>,
  ) {}

  async enqueueAnalysisJob(payload: AnalysisJobPayload) {
    return this.queue.add(queueJobNameForJobType(payload.jobType), payload, {
      jobId: payload.jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2_000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed, deadLettered] =
      await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
        this.deadLetterQueue.getWaitingCount(),
      ]);

    return {
      name: ANALYSIS_QUEUE,
      deadLetterQueue: ANALYSIS_DLQ,
      waiting,
      active,
      completed,
      failed,
      delayed,
      deadLettered,
    };
  }

  async moveToDeadLetter(payload: AnalysisJobPayload, reason: string) {
    return this.deadLetterQueue.add(
      'failed-analysis-job',
      {
        ...payload,
        reason,
        failedAt: new Date().toISOString(),
      },
      {
        jobId: payload.jobId,
      },
    );
  }
}
