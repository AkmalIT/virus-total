import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AnalysisResponseDto,
  LiveStreamInfoDto,
} from './dto/analysis-response.dto';
import { AnalysisService } from './analysis.service';

@ApiTags('Analysis')
@ApiBearerAuth('access-token')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get(':submissionId/live')
  @ApiOperation({
    summary: 'Информация о WebSocket-стриме',
    description:
      'Возвращает адрес WebSocket namespace, событие для подписки и список событий для реального времени.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'ID submission',
    example: 'clx1abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'Параметры WebSocket подключения',
    type: LiveStreamInfoDto,
  })
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
  @ApiOperation({
    summary: 'Частичные результаты анализа',
    description:
      'Возвращает уже доступные results и IOC, пока анализ ещё идёт.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'ID submission',
    example: 'clx1abc...',
  })
  @ApiResponse({ status: 200, description: 'Частичные results и IOC' })
  @ApiResponse({ status: 404, description: 'Submission не найден' })
  getPartialResults(@Param('submissionId') submissionId: string) {
    return this.analysisService.getPartialResults(submissionId);
  }

  @Get(':submissionId')
  @ApiOperation({
    summary: 'Полный анализ submission',
    description:
      'Возвращает submission, прогресс jobs и агрегированные метрики (score, maxSeverity, iocCount).',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'ID submission',
    example: 'clx1abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные анализа',
    type: AnalysisResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Submission не найден' })
  getAnalysis(@Param('submissionId') submissionId: string) {
    return this.analysisService.getAnalysis(submissionId);
  }
}
