import { Controller, Get, Param } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get(':submissionId/live')
  getLiveStreamInfo(@Param('submissionId') submissionId: string) {
    return {
      websocket: '/analysis-stream',
      subscribeEvent: 'analysis.subscribe',
      submissionId,
      events: [
        'analysis.update',
        'submission.created',
        'job.queued',
        'job.started',
        'job.progress',
        'job.finished',
      ],
    };
  }

  @Get(':submissionId/partial')
  getPartialResults(@Param('submissionId') submissionId: string) {
    return this.analysisService.getPartialResults(submissionId);
  }

  @Get(':submissionId')
  getAnalysis(@Param('submissionId') submissionId: string) {
    return this.analysisService.getAnalysis(submissionId);
  }
}
