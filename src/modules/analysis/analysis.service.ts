import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalysisJobStatus, Severity } from '@prisma/client';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';
import { IocsService } from '../iocs/iocs.service';
import { ResultsService } from '../results/results.service';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
    private readonly iocsService: IocsService,
  ) {}

  async getAnalysis(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: {
        id: submissionId,
      },
      include: {
        analysis_jobs: {
          include: {
            analysis_results: true,
          },
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        },
        iocs: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const jobs = submission.analysis_jobs;
    const results = jobs.flatMap((job) => job.analysis_results);
    const scores = results
      .map((result) => result.score)
      .filter((score): score is number => typeof score === 'number');

    const aggregateScore =
      scores.length === 0
        ? null
        : Number(
            (
              scores.reduce((total, score) => total + score, 0) / scores.length
            ).toFixed(4),
          );

    return serializePrisma({
      submission,
      progress: {
        total: jobs.length,
        pending: jobs.filter((job) => job.status === AnalysisJobStatus.pending)
          .length,
        queued: jobs.filter((job) => job.status === AnalysisJobStatus.queued)
          .length,
        running: jobs.filter((job) => job.status === AnalysisJobStatus.running)
          .length,
        completed: jobs.filter(
          (job) => job.status === AnalysisJobStatus.completed,
        ).length,
        failed: jobs.filter((job) => job.status === AnalysisJobStatus.failed)
          .length,
      },
      aggregate: {
        score: aggregateScore,
        maxSeverity: this.maxSeverity(results.map((result) => result.severity)),
        iocCount: submission.iocs.length,
      },
    });
  }

  async getPartialResults(submissionId: string) {
    const [results, iocs] = await Promise.all([
      this.resultsService.findBySubmissionId(submissionId),
      this.iocsService.findBySubmissionId(submissionId),
    ]);

    return {
      submissionId,
      results,
      iocs,
    };
  }

  private maxSeverity(severities: Severity[]) {
    const order = [
      Severity.info,
      Severity.low,
      Severity.medium,
      Severity.high,
      Severity.critical,
    ];

    return (
      severities.sort(
        (left, right) => order.indexOf(right) - order.indexOf(left),
      )[0] ?? null
    );
  }
}
