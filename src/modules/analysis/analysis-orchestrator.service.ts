import { Injectable } from '@nestjs/common';
import { AnalysisJobType, SubmissionType } from '@prisma/client';
import { JobsService } from '../jobs/jobs.service';

type SubmissionForPlanning = {
  id: string;
  type: SubmissionType;
};

@Injectable()
export class AnalysisOrchestratorService {
  constructor(private readonly jobsService: JobsService) {}

  async createJobsForSubmission(submission: SubmissionForPlanning) {
    const jobTypes = this.planJobTypes(submission.type);

    return Promise.all(
      jobTypes.map((jobType, index) =>
        this.jobsService.createForSubmission(
          submission.id,
          jobType,
          jobTypes.length - index,
        ),
      ),
    );
  }

  enqueueJobsForSubmission(submissionId: string) {
    return this.jobsService.enqueueForSubmission(submissionId);
  }

  planJobTypes(type: SubmissionType): AnalysisJobType[] {
    if (type === SubmissionType.file) {
      return [
        AnalysisJobType.static_analysis,
        AnalysisJobType.sandbox,
        AnalysisJobType.ai_summary,
      ];
    }

    if (type === SubmissionType.url || type === SubmissionType.domain) {
      return [AnalysisJobType.url_scan, AnalysisJobType.ai_summary];
    }

    return [AnalysisJobType.url_scan, AnalysisJobType.ai_summary];
  }
}
