import { AnalysisResultType, Severity } from '@prisma/client';
import { AppLogger } from '../../common/logging/app-logger.service';
import { PrismaService } from '../../infra/db/prisma.service';
import { ElasticService } from '../../infra/elastic/elastic.service';
import { ResultsService } from './results.service';

describe('ResultsService', () => {
  it('returns existing result on retry via upsert without duplicate rows', async () => {
    const existingResult = {
      id: 'result-1',
      job_id: 'job-1',
      result_type: AnalysisResultType.static_report,
      severity: Severity.low,
      score: 0.12,
      data: {
        malicious: false,
      },
      created_at: new Date(),
    };
    const prisma = {
      analysisResult: {
        upsert: jest.fn().mockResolvedValue(existingResult),
      },
    } as unknown as PrismaService;
    const elastic = {
      indexAnalysisResult: jest.fn().mockResolvedValue(undefined),
    } as unknown as ElasticService;
    const logger = {
      warn: jest.fn(),
    } as unknown as AppLogger;
    const service = new ResultsService(prisma, elastic, logger);

    const result = await service.create({
      job_id: existingResult.job_id,
      result_type: existingResult.result_type,
      severity: existingResult.severity,
      score: existingResult.score,
      data: existingResult.data,
    });

    expect(result).toMatchObject({
      id: existingResult.id,
      job_id: existingResult.job_id,
      result_type: existingResult.result_type,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.analysisResult.upsert).toHaveBeenCalledWith({
      where: {
        job_id_result_type: {
          job_id: existingResult.job_id,
          result_type: existingResult.result_type,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      create: expect.objectContaining({
        job_id: existingResult.job_id,
        result_type: existingResult.result_type,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      update: expect.objectContaining({
        severity: existingResult.severity,
        score: existingResult.score,
        data: existingResult.data,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(elastic.indexAnalysisResult).toHaveBeenCalledTimes(1);
  });
});
