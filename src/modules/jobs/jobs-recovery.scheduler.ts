import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppLogger } from '../../common/logging/app-logger.service';
import { getJobRecoveryIntervalMs } from './job-timeouts';
import { JobsService } from './jobs.service';

const ZOMBIE_RECOVERY_INTERVAL = 'zombie-job-recovery';

@Injectable()
export class JobsRecoveryScheduler implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly jobsService: JobsService,
    private readonly logger: AppLogger,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const intervalMs = getJobRecoveryIntervalMs();
    const interval = setInterval(() => {
      void this.recoverZombieJobs();
    }, intervalMs);

    this.schedulerRegistry.addInterval(ZOMBIE_RECOVERY_INTERVAL, interval);
  }

  onModuleDestroy() {
    this.schedulerRegistry.deleteInterval(ZOMBIE_RECOVERY_INTERVAL);
  }

  private async recoverZombieJobs() {
    const result = await this.jobsService.recoverZombieJobs();

    if (result.recovered > 0 || result.failed > 0) {
      this.logger.event(
        'jobs.recovery.completed',
        'Zombie job recovery finished',
        JobsRecoveryScheduler.name,
        {
          recovered: result.recovered,
          failed: result.failed,
        },
      );
    }
  }
}
