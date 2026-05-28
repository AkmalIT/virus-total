import { Controller, Get, Param } from '@nestjs/common';
import { IocsService } from './iocs.service';

@Controller('iocs')
export class IocsController {
  constructor(private readonly iocsService: IocsService) {}

  @Get(':submissionId')
  findBySubmission(@Param('submissionId') submissionId: string) {
    return this.iocsService.findBySubmissionId(submissionId);
  }
}
