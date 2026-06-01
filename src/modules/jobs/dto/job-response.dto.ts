import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobDto {
  @ApiProperty({ example: 'clx1abc...' })
  id!: string;

  @ApiProperty({ example: 'clx1abc...' })
  submission_id!: string;

  @ApiProperty({
    example: 'yara_scan',
    enum: [
      'yara_scan',
      'pe_analysis',
      'url_reputation',
      'hash_lookup',
      'domain_reputation',
    ],
  })
  job_type!: string;

  @ApiProperty({
    example: 'queued',
    enum: ['pending', 'queued', 'running', 'completed', 'failed'],
  })
  status!: string;

  @ApiProperty({ example: 1 })
  priority!: number;

  @ApiProperty({ example: 0 })
  attempts!: number;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  started_at?: string | null;

  @ApiPropertyOptional({ example: '2024-01-01T00:01:00.000Z' })
  finished_at?: string | null;

  @ApiPropertyOptional({ example: 'Connection timeout' })
  error_message?: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-01-01T00:01:00.000Z' })
  updated_at!: string;
}

export class QueueStatsDto {
  @ApiProperty({ example: 5, description: 'Задания ожидающие обработки' })
  waiting!: number;

  @ApiProperty({ example: 2, description: 'Активные задания' })
  active!: number;

  @ApiProperty({ example: 10, description: 'Завершённые задания' })
  completed!: number;

  @ApiProperty({ example: 1, description: 'Задания с ошибками' })
  failed!: number;

  @ApiProperty({ example: 0, description: 'Отложенные задания' })
  delayed!: number;
}

export class DeadLetterJobDto {
  @ApiProperty({ example: '42', description: 'ID записи в dead-letter queue' })
  id!: string;

  @ApiProperty({ example: 'clx1abc...' })
  jobId!: string;

  @ApiProperty({ example: 'clx1abc...' })
  submissionId!: string;

  @ApiProperty({ example: 'yara_scan' })
  jobType!: string;

  @ApiProperty({ example: 3 })
  attempts!: number;

  @ApiProperty({ example: 'Connection timeout after 30s' })
  failedReason!: string;

  @ApiProperty({ example: '2024-01-01T00:05:00.000Z' })
  failedAt!: string;

  @ApiProperty({
    description: 'Оригинальный payload задания',
    additionalProperties: true,
  })
  payload!: unknown;
}

export class RecoverJobsResponseDto {
  @ApiProperty({ example: 3 })
  recovered!: number;

  @ApiProperty({ example: 1 })
  failed!: number;

  @ApiProperty({ isArray: true, description: 'Список jobs' })
  jobs!: unknown[];
}

export class RetryDeadLetterResponseDto {
  @ApiProperty({ example: '42' })
  deadLetterJobId!: string;

  @ApiProperty({ type: () => JobDto })
  retriedJob!: JobDto;
}
