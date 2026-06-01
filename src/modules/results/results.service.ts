import { Injectable } from '@nestjs/common';
import {
  AnalysisResult,
  AnalysisResultType,
  Prisma,
  Severity,
} from '@prisma/client';
import { AppLogger } from '../../common/logging/app-logger.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: ElasticService,
    private readonly logger: AppLogger,
  ) {}

  async create(input: CreateResultInput) {
    const result = await this.prisma.analysisResult.upsert({
      where: {
        job_id_result_type: {
          job_id: input.job_id,
          result_type: input.result_type,
        },
      },
      create: {
        job_id: input.job_id,
        severity: input.severity,
        score: input.score,
        result_type: input.result_type,
        data: input.data,
      },
      update: {
        severity: input.severity,
        score: input.score,
        data: input.data,
      },
    });

    await this.indexResult(result);

    return serializePrisma(result);
  }

  async existsForJob(jobId: string, resultType?: AnalysisResultType) {
    if (resultType) {
      const result = await this.prisma.analysisResult.findUnique({
        where: {
          job_id_result_type: {
            job_id: jobId,
            result_type: resultType,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(result);
    }

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
        `Failed to index analysis result ${result.id}`,
        ResultsService.name,
        {
          jobId: result.job_id,
          error: this.errorMessage(error),
        },
      );
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Unknown Elasticsearch error';
  }
}
