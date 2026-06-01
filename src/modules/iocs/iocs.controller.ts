import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IocsService } from './iocs.service';

@ApiTags('IOCs')
@ApiBearerAuth('access-token')
@Controller('iocs')
export class IocsController {
  constructor(private readonly iocsService: IocsService) {}

  @Get(':submissionId')
  @ApiOperation({
    summary: 'IOC по submission',
    description:
      'Возвращает все индикаторы компрометации (IP, domain, URL, hash и т.д.), ' +
      'найденные в процессе анализа данного submission.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'ID submission',
    example: 'clx1abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'Список IOC',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clx1abc...' },
          submission_id: { type: 'string', example: 'clx1abc...' },
          type: {
            type: 'string',
            example: 'ip',
            enum: ['ip', 'domain', 'url', 'hash', 'email'],
          },
          value: { type: 'string', example: '192.168.1.1' },
          confidence: { type: 'number', example: 0.95 },
          created_at: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    },
  })
  findBySubmission(@Param('submissionId') submissionId: string) {
    return this.iocsService.findBySubmissionId(submissionId);
  }
}
