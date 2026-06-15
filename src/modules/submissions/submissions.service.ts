import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnalysisJobStatus,
  SubmissionStatus,
  SubmissionType,
} from '@prisma/client';
import { AppLogger } from '../../common/logging/app-logger.service';
import { runWithCorrelation } from '../../common/logging/correlation.context';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AnalysisOrchestratorService } from '../analysis/analysis-orchestrator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFileSubmissionDto } from './dto/create-file-submission.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateUrlSubmissionDto } from './dto/create-url-submission.dto';
import { parseMultipartUpload } from './multipart.util';
import { Request } from 'express';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly orchestrator: AnalysisOrchestratorService,
    private readonly notifications: NotificationsService,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateSubmissionDto) {
    this.validateSubmission(dto);

    const reusableSubmission = await this.findReusableBySha256(
      dto.type,
      dto.sha256,
    );

    if (reusableSubmission) {
      return this.reusedResponse(reusableSubmission);
    }

    try {
      const { submission } = await this.createSubmissionWithJobs(dto);

      return runWithCorrelation({ submissionId: submission.id }, async () => {
        this.logger.event(
          'submission.accepted',
          'Submission persisted, enqueueing jobs',
          SubmissionsService.name,
        );

        this.notifications.emitSubmissionCreated(submission.id, {
          submissionId: submission.id,
          type: submission.type,
          status: submission.status,
        });

        try {
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
        } catch (error) {
          await this.recordEnqueueFailure(
            submission.id,
            this.errorMessage(error),
          );

          throw error;
        }
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existingSubmission = await this.findReusableBySha256(
          dto.type,
          dto.sha256,
        );

        if (existingSubmission) {
          return this.reusedResponse(existingSubmission);
        }
      }

      throw error;
    }
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

  async uploadFile(request: Request) {
    const parsed = await parseMultipartUpload(request);
    const userId = parsed.fields.user_id;

    if (!userId) {
      throw new BadRequestException('user_id field is required');
    }

    const artifact = await this.storage.uploadSubmissionStream({
      userId,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      stream: parsed.stream,
    });

    return this.create({
      user_id: userId,
      type: SubmissionType.file,
      file_name: parsed.fileName,
      sha256: artifact.sha256,
      mime_type: parsed.mimeType,
      size_bytes: artifact.sizeBytes,
      storage_key: artifact.storageKey,
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
      throw new BadRequestException(
        'file_name is required for file submissions',
      );
    }

    if (dto.type === SubmissionType.hash && !dto.sha256) {
      throw new BadRequestException('sha256 is required for hash submissions');
    }
  }

  private async createSubmissionWithJobs(dto: CreateSubmissionDto) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
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
          status: SubmissionStatus.accepted,
        },
      });
      const jobTypes = this.orchestrator.planJobTypes(submission.type);
      const jobs = await Promise.all(
        jobTypes.map((jobType, index) =>
          tx.analysisJob.create({
            data: {
              submission_id: submission.id,
              job_type: jobType,
              status: AnalysisJobStatus.pending,
              priority: jobTypes.length - index,
            },
          }),
        ),
      );

      return {
        submission,
        jobs,
      };
    }, { timeout: 15000 });
  }

  private async recordEnqueueFailure(submissionId: string, reason: string) {
    await this.prisma.analysisJob.updateMany({
      where: {
        submission_id: submissionId,
        status: AnalysisJobStatus.pending,
      },
      data: {
        error_message: reason,
      },
    });

    this.logger.warn(
      'Enqueue failed after DB commit; jobs left pending for recovery',
      SubmissionsService.name,
      {
        eventType: 'submission.enqueue.failed',
        reason,
      },
    );

    this.notifications.emitAnalysisUpdated(submissionId, {
      submissionId,
      status: SubmissionStatus.accepted,
      enqueueError: reason,
    });
  }

  private findReusableBySha256(type: SubmissionType, sha256?: string) {
    if (!sha256) {
      return null;
    }

    return this.prisma.submission.findUnique({
      where: {
        type_sha256: {
          type,
          sha256,
        },
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

  private reusedResponse<T extends { analysis_jobs: unknown }>(submission: T) {
    return serializePrisma({
      submission,
      jobs: submission.analysis_jobs,
      reused: true,
    });
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown enqueue error';
  }
}
