import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AnalysisJob,
  AnalysisJobStatus,
  AnalysisJobType,
  SubmissionStatus,
} from '@prisma/client';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';
import { AnalysisQueueService } from '../../infra/queue/analysis-queue.service';
import { NotificationsService } from '../notifications/notifications.service';

const RECOVERY_RUNNING_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisQueue: AnalysisQueueService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForSubmission(
    submissionId: string,
    jobType: AnalysisJobType,
    priority = 1,
  ) {
    const existingJob = await this.prisma.analysisJob.findFirst({
      where: {
        submission_id: submissionId,
        job_type: jobType,
      },
    });

    const job = existingJob
      ? await this.prisma.analysisJob.update({
          where: {
            id: existingJob.id,
          },
          data: {
            priority,
          },
        })
      : await this.prisma.analysisJob.create({
          data: {
            submission_id: submissionId,
            job_type: jobType,
            status: AnalysisJobStatus.pending,
            priority,
          },
        });

    return serializePrisma(job);
  }

  async createPendingJob(
    submissionId: string,
    jobType: AnalysisJobType,
    priority = 1,
  ) {
    const job = await this.prisma.analysisJob.create({
      data: {
        submission_id: submissionId,
        job_type: jobType,
        status: AnalysisJobStatus.pending,
        priority,
      },
    });

    return serializePrisma(job);
  }

  async enqueueForSubmission(submissionId: string) {
    const jobs = await this.prisma.analysisJob.findMany({
      where: {
        submission_id: submissionId,
        status: {
          in: [AnalysisJobStatus.pending, AnalysisJobStatus.queued],
        },
      },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    });

    const queuedJobs = await this.enqueueMany(jobs);

    await this.syncSubmissionStatus(submissionId);

    return queuedJobs;
  }

  async enqueue(id: string) {
    const job = await this.getExistingJob(id);

    if (job.status === AnalysisJobStatus.completed) {
      return serializePrisma(job);
    }

    if (await this.hasResult(id)) {
      return this.markCompleted(id);
    }

    try {
      await this.analysisQueue.enqueueAnalysisJob({
        jobId: job.id,
        submissionId: job.submission_id,
        jobType: job.job_type,
      });
    } catch (error) {
      await this.prisma.analysisJob.update({
        where: {
          id,
        },
        data: {
          error_message: this.errorMessage(error),
        },
      });

      throw error;
    }

    const queuedJob = await this.prisma.analysisJob.update({
      where: {
        id,
      },
      data: {
        status: AnalysisJobStatus.queued,
        started_at: null,
        finished_at: null,
        error_message: null,
      },
    });

    this.notifications.emitJobQueued(queuedJob.submission_id, {
      jobId: queuedJob.id,
      jobType: queuedJob.job_type,
      status: queuedJob.status,
    });

    return serializePrisma(queuedJob);
  }

  async retry(id: string) {
    const job = await this.getExistingJob(id);

    if (await this.hasResult(id)) {
      return this.markCompleted(id);
    }

    await this.prisma.analysisJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: AnalysisJobStatus.pending,
        attempts: 0,
        started_at: null,
        finished_at: null,
        error_message: null,
      },
    });

    return this.enqueue(id);
  }

  async recoverOpenJobs() {
    const staleRunningStartedBefore = new Date(
      Date.now() - RECOVERY_RUNNING_TIMEOUT_MS,
    );

    const jobs = await this.prisma.analysisJob.findMany({
      where: {
        OR: [
          {
            status: AnalysisJobStatus.pending,
          },
          {
            status: AnalysisJobStatus.queued,
          },
          {
            status: AnalysisJobStatus.running,
            started_at: {
              lt: staleRunningStartedBefore,
            },
          },
        ],
      },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    });

    const recoveredJobs = await this.enqueueMany(jobs);
    const failed = recoveredJobs.filter(
      (job) => this.isSerializedJob(job) && job.error_message,
    ).length;

    return {
      recovered: recoveredJobs.length - failed,
      failed,
      jobs: recoveredJobs,
    };
  }

  async list(filters: { submissionId?: string; status?: AnalysisJobStatus }) {
    const jobs = await this.prisma.analysisJob.findMany({
      where: {
        submission_id: filters.submissionId,
        status: filters.status,
      },
      include: {
        analysis_results: true,
      },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    });

    return serializePrisma(jobs);
  }

  async findById(id: string) {
    const job = await this.prisma.analysisJob.findUnique({
      where: { id },
      include: {
        submission: true,
        analysis_results: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Analysis job not found');
    }

    return serializePrisma(job);
  }

  async markRunning(id: string, attempt: number) {
    const job = await this.prisma.analysisJob.update({
      where: { id },
      data: {
        status: AnalysisJobStatus.running,
        attempts: attempt,
        started_at: new Date(),
        error_message: null,
      },
    });

    await this.prisma.submission.update({
      where: {
        id: job.submission_id,
      },
      data: {
        status: SubmissionStatus.processing,
      },
    });

    this.notifications.emitJobStarted(job.submission_id, {
      jobId: job.id,
      jobType: job.job_type,
      status: job.status,
    });

    return serializePrisma(job);
  }

  async markCompleted(id: string) {
    const job = await this.prisma.analysisJob.update({
      where: { id },
      data: {
        status: AnalysisJobStatus.completed,
        finished_at: new Date(),
        error_message: null,
      },
    });

    await this.syncSubmissionStatus(job.submission_id);
    this.notifications.emitJobFinished(job.submission_id, {
      jobId: job.id,
      jobType: job.job_type,
      status: job.status,
    });

    return serializePrisma(job);
  }

  async markFailed(id: string, reason?: string) {
    const job = await this.prisma.analysisJob.update({
      where: { id },
      data: {
        status: AnalysisJobStatus.failed,
        finished_at: new Date(),
        error_message: reason,
      },
    });

    await this.syncSubmissionStatus(job.submission_id);
    this.notifications.emitJobFinished(job.submission_id, {
      jobId: job.id,
      jobType: job.job_type,
      status: job.status,
      reason,
    });

    return serializePrisma(job);
  }

  emitProgress(
    submissionId: string,
    jobId: string,
    jobType: AnalysisJobType,
    progress: number,
  ) {
    this.notifications.emitJobProgress(submissionId, {
      jobId,
      jobType,
      progress,
      status: AnalysisJobStatus.running,
    });
  }

  private async getExistingJob(id: string): Promise<AnalysisJob> {
    const job = await this.prisma.analysisJob.findUnique({
      where: {
        id,
      },
    });

    if (!job) {
      throw new NotFoundException('Analysis job not found');
    }

    return job;
  }

  private async hasResult(jobId: string) {
    const result = await this.prisma.analysisResult.findFirst({
      where: {
        job_id: jobId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(result);
  }

  private async enqueueMany(jobs: AnalysisJob[]) {
    const queuedJobs: unknown[] = [];

    for (const job of jobs) {
      try {
        queuedJobs.push(await this.enqueue(job.id));
      } catch {
        queuedJobs.push(serializePrisma(await this.getExistingJob(job.id)));
      }
    }

    return queuedJobs;
  }

  private isSerializedJob(
    job: unknown,
  ): job is { status: string; error_message?: string | null } {
    return typeof job === 'object' && job !== null && 'status' in job;
  }

  private async syncSubmissionStatus(submissionId: string) {
    const jobs = await this.prisma.analysisJob.findMany({
      where: {
        submission_id: submissionId,
      },
    });

    const hasRunningJob = jobs.some(
      (job) => job.status === AnalysisJobStatus.running,
    );
    const hasQueuedJob = jobs.some(
      (job) =>
        job.status === AnalysisJobStatus.pending ||
        job.status === AnalysisJobStatus.queued ||
        job.status === AnalysisJobStatus.running,
    );

    const nextStatus = hasRunningJob
      ? SubmissionStatus.processing
      : hasQueuedJob
        ? SubmissionStatus.queued
        : jobs.some((job) => job.status === AnalysisJobStatus.failed)
          ? SubmissionStatus.failed
          : SubmissionStatus.completed;

    const submission = await this.prisma.submission.update({
      where: {
        id: submissionId,
      },
      data: {
        status: nextStatus,
      },
    });

    this.notifications.emitAnalysisUpdated(submissionId, {
      submissionId,
      status: submission.status,
    });
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown queue error';
  }
}
