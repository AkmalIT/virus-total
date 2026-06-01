import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResultsService } from './results.service';

@ApiTags('Results')
@ApiBearerAuth('access-token')
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('job/:jobId')
  @ApiOperation({
    summary: 'Результат анализа по jobId',
    description: 'Возвращает первый analysis result для указанного job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID analysis job',
    example: 'clx1abc...',
  })
  @ApiResponse({ status: 200, description: 'Analysis result' })
  @ApiResponse({ status: 404, description: 'Result не найден' })
  findByJob(@Param('jobId') jobId: string) {
    return this.resultsService.findByJobId(jobId);
  }

  @Get(':submissionId')
  @ApiOperation({
    summary: 'Все результаты по submission',
    description:
      'Возвращает все analysis results для указанного submission, отсортированные по дате создания.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'ID submission',
    example: 'clx1abc...',
  })
  @ApiResponse({ status: 200, description: 'Список analysis results' })
  findBySubmission(@Param('submissionId') submissionId: string) {
    return this.resultsService.findBySubmissionId(submissionId);
  }
}
