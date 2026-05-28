import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/db/prisma.module';
import { IocsModule } from '../iocs/iocs.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResultsModule } from '../results/results.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisOrchestratorService } from './analysis-orchestrator.service';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    ResultsModule,
    IocsModule,
    NotificationsModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisOrchestratorService],
  exports: [AnalysisService, AnalysisOrchestratorService],
})
export class AnalysisModule {}
