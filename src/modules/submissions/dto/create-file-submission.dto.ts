import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFileSubmissionDto {
  @ApiProperty({ example: 'clx1abc...', description: 'ID пользователя' })
  user_id!: string;

  @ApiProperty({ example: 'malware.exe', description: 'Имя файла' })
  file_name!: string;

  @ApiPropertyOptional({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    description: 'SHA-256 хеш файла',
  })
  sha256?: string;

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
}
