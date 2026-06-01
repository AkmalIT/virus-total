import { ApiProperty } from '@nestjs/swagger';

export class CreateUrlSubmissionDto {
  @ApiProperty({ example: 'clx1abc...', description: 'ID пользователя' })
  user_id!: string;

  @ApiProperty({
    example: 'https://malicious.example.com/payload',
    description: 'URL для анализа',
  })
  url!: string;
}
