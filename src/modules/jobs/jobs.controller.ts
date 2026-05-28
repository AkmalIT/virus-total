import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalysisJobStatus } from '@prisma/client';
import { AnalysisQueueService } from '../../infra/queue/analysis-queue.service';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly analysisQueue: AnalysisQueueService,
  ) {}

  @Get()
  list(
    @Query('submissionId') submissionId?: string,
    @Query('status') status?: AnalysisJobStatus,
  ) {
    return this.jobsService.list({ submissionId, status });
  }

  @Get('queue/stats')
  queueStats() {
    return this.analysisQueue.getQueueStats();
  }

  @Post('queue/recover')
  recoverOpenJobs() {
    return this.jobsService.recoverOpenJobs();
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }
}
