import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysisJobStatus } from '@prisma/client';
import { AnalysisQueueService } from '../../infra/queue/analysis-queue.service';
import {
  DeadLetterJobDto,
  JobDto,
  QueueStatsDto,
  RecoverJobsResponseDto,
  RetryDeadLetterResponseDto,
} from './dto/job-response.dto';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@ApiBearerAuth('access-token')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly analysisQueue: AnalysisQueueService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Список jobs',
    description:
      'Возвращает все analysis jobs с опциональной фильтрацией по submissionId и status.',
  })
  @ApiQuery({
    name: 'submissionId',
    required: false,
    description: 'Фильтр по ID submission',
    example: 'clx1abc...',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AnalysisJobStatus,
    description: 'Фильтр по статусу job',
  })
  @ApiResponse({ status: 200, description: 'Список jobs', type: [JobDto] })
  list(
    @Query('submissionId') submissionId?: string,
    @Query('status') status?: AnalysisJobStatus,
  ) {
    return this.jobsService.list({ submissionId, status });
  }

  @Get('queue/stats')
  @ApiOperation({
    summary: 'Статистика очереди BullMQ',
    description:
      'Возвращает количество ожидающих, активных, завершённых и failed jobs в очереди.',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика очереди',
    type: QueueStatsDto,
  })
  queueStats() {
    return this.analysisQueue.getQueueStats();
  }

  @Get(['queue/dead-letter', 'dlq'])
  @ApiOperation({
    summary: 'Dead-letter jobs (DLQ)',
    description:
      'Возвращает список заданий, перемещённых в dead-letter queue после исчерпания попыток.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Максимальное количество записей (по умолчанию 50)',
    example: '50',
  })
  @ApiResponse({
    status: 200,
    description: 'Список dead-letter jobs',
    type: [DeadLetterJobDto],
  })
  deadLetterJobs(@Query('limit') limit?: string) {
    return this.jobsService.listDeadLetterJobs(Number(limit ?? 50));
  }

  @Post(['queue/dead-letter/:id/retry', 'dlq/:id/retry'])
  @ApiOperation({
    summary: 'Повторить dead-letter job',
    description:
      'Извлекает job из DLQ, сбрасывает счётчики и ставит в очередь заново.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID записи в dead-letter queue',
    example: '42',
  })
  @ApiResponse({
    status: 201,
    description: 'Job успешно переотправлен',
    type: RetryDeadLetterResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Dead-letter job не найден' })
  async retryDeadLetterJob(@Param('id') id: string) {
    const payload = await this.analysisQueue.getDeadLetterPayload(id);

    if (!payload) {
      throw new NotFoundException('Dead-letter job not found');
    }

    const retriedJob = await this.jobsService.retry(payload.jobId);

    await this.analysisQueue.removeDeadLetterJob(id);

    return {
      deadLetterJobId: id,
      retriedJob,
    };
  }

  @Post('queue/recover')
  @ApiOperation({
    summary: 'Восстановить открытые jobs',
    description:
      'Находит застрявшие (stale running) и незапущенные (pending/queued) jobs и переотправляет их в очередь.',
  })
  @ApiResponse({
    status: 201,
    description: 'Результат восстановления',
    type: RecoverJobsResponseDto,
  })
  recoverOpenJobs() {
    return this.jobsService.recoverOpenJobs();
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Повторить job по ID',
    description: 'Сбрасывает статус job на pending и переотправляет в очередь.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID analysis job',
    example: 'clx1abc...',
  })
  @ApiResponse({
    status: 201,
    description: 'Job успешно переотправлен',
    type: JobDto,
  })
  @ApiResponse({ status: 404, description: 'Job не найден' })
  retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Найти job по ID' })
  @ApiParam({
    name: 'id',
    description: 'ID analysis job',
    example: 'clx1abc...',
  })
  @ApiResponse({ status: 200, description: 'Данные job', type: JobDto })
  @ApiResponse({ status: 404, description: 'Job не найден' })
  findById(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }
}
