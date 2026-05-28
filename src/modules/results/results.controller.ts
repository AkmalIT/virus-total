import { Controller, Get, Param } from '@nestjs/common';
import { ResultsService } from './results.service';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('job/:jobId')
  findByJob(@Param('jobId') jobId: string) {
    return this.resultsService.findByJobId(jobId);
  }

  @Get(':submissionId')
  findBySubmission(@Param('submissionId') submissionId: string) {
    return this.resultsService.findBySubmissionId(submissionId);
  }
}
