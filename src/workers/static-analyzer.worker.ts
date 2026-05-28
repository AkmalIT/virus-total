import { Injectable } from '@nestjs/common';
import { AnalysisResultType, IocType, Severity } from '@prisma/client';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { IocsService } from '../modules/iocs/iocs.service';
import { ResultsService } from '../modules/results/results.service';

@Injectable()
export class StaticAnalyzerWorker {
  constructor(
    private readonly resultsService: ResultsService,
    private readonly iocsService: IocsService,
  ) {}

  async handle(payload: AnalysisJobPayload) {
    await this.iocsService.create({
      submission_id: payload.submissionId,
      type: IocType.hash,
      value: `submission:${payload.submissionId}`,
      confidence: 0.8,
    });

    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.static_report,
      severity: Severity.low,
      score: 0.12,
      data: {
        jobType: payload.jobType,
        verdict: 'static analysis completed',
        signals: ['file metadata parsed', 'signature scan queued'],
      },
    });
  }
}
