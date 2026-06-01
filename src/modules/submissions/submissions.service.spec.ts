import { SubmissionStatus, SubmissionType } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AnalysisOrchestratorService } from '../analysis/analysis-orchestrator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  it('falls back to existing sha256 submission when concurrent create hits unique constraint', async () => {
    const existingSubmission = {
      id: 'existing-submission',
      user_id: 'user-1',
      type: SubmissionType.file,
      status: SubmissionStatus.completed,
      file_name: 'sample.exe',
      mime_type: 'application/x-msdownload',
      size_bytes: null,
      sha256: 'a'.repeat(64),
      storage_key: 'submissions/user-1/sample.exe',
      url: null,
      created_at: new Date(),
      updated_at: new Date(),
      analysis_jobs: [],
      iocs: [],
    };
    const prisma = {
      submission: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingSubmission),
      },
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    } as unknown as PrismaService;
    const service = new SubmissionsService(
      prisma,
      {} as StorageService,
      {} as AnalysisOrchestratorService,
      {} as NotificationsService,
      {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        event: jest.fn(),
        timed: jest.fn(),
      } as unknown as import('../../common/logging/app-logger.service').AppLogger,
    );

    const result = await service.create({
      user_id: 'user-1',
      type: SubmissionType.file,
      file_name: 'sample.exe',
      sha256: existingSubmission.sha256,
    });

    expect(result).toMatchObject({
      reused: true,
      submission: {
        id: existingSubmission.id,
        sha256: existingSubmission.sha256,
      },
      jobs: [],
    });
  });
});
