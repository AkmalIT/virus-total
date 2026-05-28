import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalysisQueueService } from '../infra/queue/analysis-queue.service';
import {
  ANALYSIS_JOB_NAMES,
  ANALYSIS_QUEUE,
  AnalysisJobPayload,
} from '../infra/queue/queue.constants';
import { JobsService } from '../modules/jobs/jobs.service';
import { ResultsService } from '../modules/results/results.service';
import { AiAnalyzerWorker } from './ai-analyzer.worker';
import { SandboxExecutorWorker } from './sandbox-executor.worker';
import { StaticAnalyzerWorker } from './static-analyzer.worker';
import { UrlAnalyzerWorker } from './url-analyzer.worker';

@Injectable()
@Processor(ANALYSIS_QUEUE, {
  concurrency: 4,
})
export class AnalysisQueueProcessor extends WorkerHost {
  constructor(
    private readonly jobsService: JobsService,
    private readonly resultsService: ResultsService,
    private readonly analysisQueue: AnalysisQueueService,
    private readonly staticAnalyzer: StaticAnalyzerWorker,
    private readonly urlAnalyzer: UrlAnalyzerWorker,
    private readonly aiAnalyzer: AiAnalyzerWorker,
    private readonly sandboxExecutor: SandboxExecutorWorker,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobPayload>) {
    const { jobId, submissionId, jobType } = job.data;

    const existingResult = await this.resultsService.findUniqueByJobId(jobId);

    if (existingResult) {
      await this.jobsService.markCompleted(jobId);

      return existingResult;
    }

    await this.jobsService.markRunning(jobId, job.attemptsMade + 1);
    await job.updateProgress(10);
    this.jobsService.emitProgress(submissionId, jobId, jobType, 10);

    try {
      const result = await this.dispatch(job);

      await job.updateProgress(100);
      this.jobsService.emitProgress(submissionId, jobId, jobType, 100);
      await this.jobsService.markCompleted(jobId);

      return result;
    } catch (error) {
      const reason = this.errorMessage(error);

      if (this.isFinalAttempt(job)) {
        await this.jobsService.markFailed(jobId, reason);
        await this.analysisQueue.moveToDeadLetter(job.data, reason);
      }

      throw error;
    }
  }

  private dispatch(job: Job<AnalysisJobPayload>) {
    if (job.name === ANALYSIS_JOB_NAMES.static) {
      return this.staticAnalyzer.handle(job.data);
    }

    if (job.name === ANALYSIS_JOB_NAMES.ai) {
      return this.aiAnalyzer.handle(job.data);
    }

    if (job.name === ANALYSIS_JOB_NAMES.sandbox) {
      return this.sandboxExecutor.handle(job.data);
    }

    return this.urlAnalyzer.handle(job.data);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown worker error';
  }

  private isFinalAttempt(job: Job<AnalysisJobPayload>) {
    return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  }
}
