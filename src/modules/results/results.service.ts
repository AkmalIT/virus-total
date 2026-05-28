import { Injectable, Logger } from '@nestjs/common';
import {
  AnalysisResult,
  AnalysisResultType,
  Prisma,
  Severity,
} from '@prisma/client';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';
import { ElasticService } from '../../infra/elastic/elastic.service';

type CreateResultInput = {
  job_id: string;
  result_type: AnalysisResultType;
  severity: Severity;
  score?: number | null;
  data: Prisma.InputJsonObject;
};

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: ElasticService,
  ) {}

  async create(input: CreateResultInput) {
    const existingResult = await this.prisma.analysisResult.findFirst({
      where: {
        job_id: input.job_id,
      },
    });

    if (existingResult) {
      await this.indexResult(existingResult);

      return serializePrisma(existingResult);
    }

    const result = await this.prisma.analysisResult.create({
      data: {
        job_id: input.job_id,
        severity: input.severity,
        score: input.score,
        result_type: input.result_type,
        data: input.data,
      },
    });

    await this.indexResult(result);

    return serializePrisma(result);
  }

  async existsForJob(jobId: string) {
    const result = await this.prisma.analysisResult.findFirst({
      where: {
        job_id: jobId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(result);
  }

  async findUniqueByJobId(jobId: string) {
    const result = await this.prisma.analysisResult.findFirst({
      where: {
        job_id: jobId,
      },
    });

    return serializePrisma(result);
  }

  async findBySubmissionId(submissionId: string) {
    const results = await this.prisma.analysisResult.findMany({
      where: {
        job: {
          submission_id: submissionId,
        },
      },
      include: {
        job: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return serializePrisma(results);
  }

  async findByJobId(jobId: string) {
    const result = await this.prisma.analysisResult.findFirst({
      where: {
        job_id: jobId,
      },
    });

    return serializePrisma(result);
  }

  private async indexResult(result: AnalysisResult) {
    try {
      await this.elastic.indexAnalysisResult(result.id, {
        id: result.id,
        jobId: result.job_id,
        type: result.result_type,
        severity: result.severity,
        score: result.score,
        data: result.data,
        createdAt: result.created_at,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to index analysis result ${result.id}: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Unknown Elasticsearch error';
  }
}
