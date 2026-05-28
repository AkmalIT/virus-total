import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateFileSubmissionDto } from './dto/create-file-submission.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateUrlSubmissionDto } from './dto/create-url-submission.dto';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(dto);
  }

  @Post('file')
  createFile(@Body() dto: CreateFileSubmissionDto) {
    return this.submissionsService.createFile(dto);
  }

  @Post('url')
  createUrl(@Body() dto: CreateUrlSubmissionDto) {
    return this.submissionsService.createUrl(dto);
  }

  @Get()
  list(@Query('userId') userId?: string) {
    return this.submissionsService.list(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.submissionsService.findById(id);
  }
}
