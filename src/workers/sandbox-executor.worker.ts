import { Injectable } from '@nestjs/common';
import { AnalysisResultType, Severity } from '@prisma/client';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { ResultsService } from '../modules/results/results.service';

@Injectable()
export class SandboxExecutorWorker {
  constructor(private readonly resultsService: ResultsService) {}

  async handle(payload: AnalysisJobPayload) {
    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.sandbox_report,
      severity: Severity.medium,
      score: 0.35,
      data: {
        jobType: payload.jobType,
        processes: [],
        networkCalls: [],
        suspiciousApis: [],
        riskScore: 35,
        verdict: 'sandbox execution placeholder completed',
      },
    });
  }
}
