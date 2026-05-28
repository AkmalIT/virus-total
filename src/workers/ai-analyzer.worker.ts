import { Injectable } from '@nestjs/common';
import { AnalysisResultType, Severity } from '@prisma/client';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { ResultsService } from '../modules/results/results.service';

@Injectable()
export class AiAnalyzerWorker {
  constructor(private readonly resultsService: ResultsService) {}

  async handle(payload: AnalysisJobPayload) {
    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.ai_summary,
      severity: Severity.low,
      score: null,
      data: {
        jobType: payload.jobType,
        summary: 'No high-risk behavior was identified by the MVP AI analyzer.',
      },
    });
  }
}
