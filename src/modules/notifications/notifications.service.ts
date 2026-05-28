import { Injectable } from '@nestjs/common';
import { ANALYSIS_EVENTS } from './analysis-events';
import { AnalysisStreamGateway } from './analysis-stream.gateway';

@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: AnalysisStreamGateway) {}

  emitSubmissionCreated(
    submissionId: string,
    payload: Record<string, unknown>,
  ) {
    this.emitToSubmission(
      submissionId,
      ANALYSIS_EVENTS.submissionCreated,
      payload,
    );
  }

  emitJobQueued(submissionId: string, payload: Record<string, unknown>) {
    this.emitToSubmission(submissionId, ANALYSIS_EVENTS.jobQueued, payload);
  }

  emitJobStarted(submissionId: string, payload: Record<string, unknown>) {
    this.emitToSubmission(submissionId, ANALYSIS_EVENTS.jobStarted, payload);
  }

  emitJobProgress(submissionId: string, payload: Record<string, unknown>) {
    this.emitToSubmission(submissionId, ANALYSIS_EVENTS.jobProgress, payload);
  }

  emitJobFinished(submissionId: string, payload: Record<string, unknown>) {
    this.emitToSubmission(submissionId, ANALYSIS_EVENTS.jobFinished, payload);
  }

  emitAnalysisUpdated(submissionId: string, payload: Record<string, unknown>) {
    this.emitToSubmission(
      submissionId,
      ANALYSIS_EVENTS.analysisUpdate,
      payload,
    );
  }

  private emitToSubmission(
    submissionId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const eventPayload = {
      event,
      submissionId,
      ...payload,
    };

    this.gateway.server
      ?.to(this.gateway.roomForSubmission(submissionId))
      .emit(event, eventPayload);

    if (event !== ANALYSIS_EVENTS.analysisUpdate) {
      this.gateway.emitJobUpdate(submissionId, payload);
    }
  }
}
