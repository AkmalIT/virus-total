import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmissionDto {
  @ApiProperty({ example: 'clx1abc...' })
  id!: string;

  @ApiProperty({ example: 'clx1abc...', description: 'ID пользователя' })
  user_id!: string;

  @ApiProperty({ example: 'file', enum: ['file', 'url', 'domain', 'hash'] })
  type!: string;

  @ApiProperty({
    example: 'accepted',
    enum: ['accepted', 'processing', 'completed', 'failed'],
  })
  status!: string;

  @ApiPropertyOptional({ example: 'malware.exe' })
  file_name?: string | null;

  @ApiPropertyOptional({ example: 'https://malicious.example.com' })
  url?: string | null;

  @ApiPropertyOptional({ example: 'application/x-msdownload' })
  mime_type?: string | null;

  @ApiPropertyOptional({ example: 204800 })
  size_bytes?: string | null;

  @ApiPropertyOptional({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  sha256?: string | null;

  @ApiPropertyOptional({ example: 'uploads/user-id/malware.exe' })
  storage_key?: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updated_at!: string;
}

export class SubmissionResponseDto {
  @ApiProperty({ type: () => SubmissionDto })
  submission!: SubmissionDto;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'Список созданных jobs',
  })
  jobs!: unknown[];

  @ApiPropertyOptional({
    example: true,
    description: 'true если submission переиспользован по sha256',
  })
  reused?: boolean;
}
