import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalysisProgressDto {
  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 0 })
  pending!: number;

  @ApiProperty({ example: 1 })
  queued!: number;

  @ApiProperty({ example: 1 })
  running!: number;

  @ApiProperty({ example: 1 })
  completed!: number;

  @ApiProperty({ example: 0 })
  failed!: number;
}

export class AnalysisAggregateDto {
  @ApiPropertyOptional({
    example: 0.85,
    description: 'Среднее значение score из всех results (0–1)',
  })
  score!: number | null;

  @ApiPropertyOptional({
    example: 'high',
    enum: ['info', 'low', 'medium', 'high', 'critical'],
  })
  maxSeverity!: string | null;

  @ApiProperty({ example: 5, description: 'Количество найденных IOC' })
  iocCount!: number;
}

export class AnalysisResponseDto {
  @ApiProperty({ description: 'Данные submission', additionalProperties: true })
  submission!: unknown;

  @ApiProperty({ type: () => AnalysisProgressDto })
  progress!: AnalysisProgressDto;

  @ApiProperty({ type: () => AnalysisAggregateDto })
  aggregate!: AnalysisAggregateDto;
}

export class LiveStreamInfoDto {
  @ApiProperty({
    example: '/analysis-stream',
    description: 'WebSocket namespace',
  })
  websocket!: string;

  @ApiProperty({
    example: 'analysis.subscribe',
    description: 'Событие для подписки',
  })
  subscribeEvent!: string;

  @ApiProperty({ example: 'clx1abc...' })
  submissionId!: string;

  @ApiProperty({
    example: [
      'analysis.update',
      'submission.created',
      'job.queued',
      'job.started',
      'job.progress',
      'job.finished',
    ],
    description: 'Список событий, которые будет отправлять сервер',
    type: [String],
  })
  events!: string[];
}
