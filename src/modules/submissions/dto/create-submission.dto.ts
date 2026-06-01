import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionType } from '@prisma/client';

export class CreateSubmissionDto {
  @ApiProperty({
    example: 'clx1abc...',
    description: 'ID пользователя, отправляющего submission',
  })
  user_id!: string;

  @ApiProperty({
    enum: SubmissionType,
    description: 'Тип submission: file, url, domain или hash',
  })
  type!: SubmissionType;

  @ApiPropertyOptional({
    example: 'malware.exe',
    description: 'Имя файла (обязательно для type=file)',
  })
  file_name?: string;

  @ApiPropertyOptional({
    example: 'https://malicious.example.com',
    description: 'URL (обязательно для type=url и type=domain)',
  })
  url?: string;

  @ApiPropertyOptional({
    example: 'application/x-msdownload',
    description: 'MIME-тип файла',
  })
  mime_type?: string;

  @ApiPropertyOptional({
    example: 204800,
    description: 'Размер файла в байтах',
  })
  size_bytes?: number | string;

  @ApiPropertyOptional({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    description: 'SHA-256 хеш файла (64 hex-символа)',
  })
  sha256?: string;

  @ApiPropertyOptional({
    example: 'uploads/user-id/malware.exe',
    description: 'Ключ объекта в хранилище (MinIO)',
  })
  storage_key?: string;
}
