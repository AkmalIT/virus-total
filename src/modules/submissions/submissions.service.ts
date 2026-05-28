import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus, SubmissionType } from '@prisma/client';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AnalysisOrchestratorService } from '../analysis/analysis-orchestrator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFileSubmissionDto } from './dto/create-file-submission.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateUrlSubmissionDto } from './dto/create-url-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly orchestrator: AnalysisOrchestratorService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateSubmissionDto) {
    this.validateSubmission(dto);

    const reusableSubmission = await this.findReusableBySha256(dto.sha256);

    if (reusableSubmission) {
      return serializePrisma({
        submission: reusableSubmission,
        jobs: reusableSubmission.analysis_jobs,
        reused: true,
      });
    }

    const submission = await this.prisma.submission.create({
      data: {
        user_id: dto.user_id,
        type: dto.type,
        file_name: dto.file_name,
        mime_type: dto.mime_type,
        size_bytes:
          dto.size_bytes === undefined ? undefined : BigInt(dto.size_bytes),
        sha256: dto.sha256,
        storage_key: dto.storage_key,
        url: dto.url,
        status: SubmissionStatus.queued,
      },
    });

    this.notifications.emitSubmissionCreated(submission.id, {
      submissionId: submission.id,
      type: submission.type,
      status: submission.status,
    });

    await this.orchestrator.createJobsForSubmission(submission);
    const jobs = await this.orchestrator.enqueueJobsForSubmission(
      submission.id,
    );
    const updatedSubmission = await this.prisma.submission.findUnique({
      where: {
        id: submission.id,
      },
    });

    return serializePrisma({
      submission: updatedSubmission ?? submission,
      jobs,
    });
  }

  createUrl(dto: CreateUrlSubmissionDto) {
    return this.create({
      user_id: dto.user_id,
      type: SubmissionType.url,
      url: dto.url,
    });
  }

  createFile(dto: CreateFileSubmissionDto) {
    const objectKey = this.storage.buildSubmissionObjectKey(
      dto.user_id,
      dto.file_name,
    );

    return this.create({
      user_id: dto.user_id,
      type: SubmissionType.file,
      file_name: dto.file_name,
      sha256: dto.sha256,
      mime_type: dto.mime_type,
      size_bytes: dto.size_bytes,
      storage_key: objectKey,
    });
  }

  async findById(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: {
        id,
      },
      include: {
        analysis_jobs: {
          include: {
            analysis_results: true,
          },
        },
        iocs: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return serializePrisma(submission);
  }

  async list(userId?: string) {
    const submissions = await this.prisma.submission.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return serializePrisma(submissions);
  }

  private validateSubmission(dto: CreateSubmissionDto) {
    if (!dto.user_id || !dto.type) {
      throw new BadRequestException('user_id and type are required');
    }

    if (
      (dto.type === SubmissionType.url || dto.type === SubmissionType.domain) &&
      !dto.url
    ) {
      throw new BadRequestException(
        'url is required for URL and domain submissions',
      );
    }

    if (dto.type === SubmissionType.file && !dto.file_name) {
      throw new BadRequestException('file_name is required for file submissions');
    }

    if (dto.type === SubmissionType.hash && !dto.sha256) {
      throw new BadRequestException('sha256 is required for hash submissions');
    }
  }

  private findReusableBySha256(sha256?: string) {
    if (!sha256) {
      return null;
    }

    return this.prisma.submission.findUnique({
      where: {
        sha256,
      },
      include: {
        analysis_jobs: {
          include: {
            analysis_results: true,
          },
        },
        iocs: true,
      },
    });
  }
}
