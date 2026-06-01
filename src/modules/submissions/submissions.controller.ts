import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateFileSubmissionDto } from './dto/create-file-submission.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateUrlSubmissionDto } from './dto/create-url-submission.dto';
import {
  SubmissionResponseDto,
  SubmissionDto,
} from './dto/submission-response.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@ApiBearerAuth('access-token')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать submission (универсальный)',
    description:
      'Создаёт submission любого типа (file/url/domain/hash). Если sha256 уже есть — возвращает существующий.',
  })
  @ApiResponse({
    status: 201,
    description: 'Submission создан',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Отсутствуют обязательные поля' })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(dto);
  }

  @Post('file/upload')
  @ApiOperation({
    summary: 'Загрузить файл (multipart/form-data)',
    description:
      'Загружает файл в MinIO и автоматически создаёт submission типа file. Поле `file` — бинарный файл, `user_id` — ID пользователя.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'user_id'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Файл для анализа',
        },
        user_id: {
          type: 'string',
          example: 'clx1abc...',
          description: 'ID пользователя',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Файл загружен и submission создан',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Поле user_id отсутствует' })
  uploadFile(@Req() request: Request) {
    return this.submissionsService.uploadFile(request);
  }

  @Post('file')
  @ApiOperation({
    summary: 'Создать file submission по метаданным',
    description:
      'Создаёт submission типа file без загрузки — файл должен быть предварительно загружен через /file/upload.',
  })
  @ApiResponse({
    status: 201,
    description: 'File submission создан',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Отсутствуют обязательные поля' })
  createFile(@Body() dto: CreateFileSubmissionDto) {
    return this.submissionsService.createFile(dto);
  }

  @Post('url')
  @ApiOperation({
    summary: 'Создать URL submission',
    description: 'Создаёт submission для анализа URL или домена.',
  })
  @ApiResponse({
    status: 201,
    description: 'URL submission создан',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Отсутствует поле url или user_id' })
  createUrl(@Body() dto: CreateUrlSubmissionDto) {
    return this.submissionsService.createUrl(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Список submissions',
    description: 'Возвращает все submissions, опционально фильтруя по userId.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Фильтр по ID пользователя',
    example: 'clx1abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'Список submissions',
    type: [SubmissionDto],
  })
  list(@Query('userId') userId?: string) {
    return this.submissionsService.list(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Найти submission по ID',
    description: 'Возвращает submission со всеми jobs, results и IOC.',
  })
  @ApiParam({ name: 'id', description: 'ID submission', example: 'clx1abc...' })
  @ApiResponse({
    status: 200,
    description: 'Submission найден',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Submission не найден' })
  findById(@Param('id') id: string) {
    return this.submissionsService.findById(id);
  }
}
