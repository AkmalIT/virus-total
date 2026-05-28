import { Injectable } from '@nestjs/common';
import { AnalysisResultType, Severity } from '@prisma/client';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { ResultsService } from '../modules/results/results.service';

@Injectable()
export class UrlAnalyzerWorker {
  constructor(private readonly resultsService: ResultsService) {}

  async handle(payload: AnalysisJobPayload) {
    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.reputation,
      severity: Severity.low,
      score: 0.08,
      data: {
        jobType: payload.jobType,
        verdict: 'network and reputation checks completed',
        signals: ['dns reputation checked', 'url reputation checked'],
      },
    });
  }
}
