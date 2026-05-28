import { Module } from '@nestjs/common';
import { IocsModule } from '../modules/iocs/iocs.module';
import { JobsModule } from '../modules/jobs/jobs.module';
import { ResultsModule } from '../modules/results/results.module';
import { AnalysisQueueProcessor } from './analysis-queue.processor';
import { AiAnalyzerWorker } from './ai-analyzer.worker';
import { SandboxExecutorWorker } from './sandbox-executor.worker';
import { StaticAnalyzerWorker } from './static-analyzer.worker';
import { UrlAnalyzerWorker } from './url-analyzer.worker';

@Module({
  imports: [JobsModule, ResultsModule, IocsModule],
  providers: [
    AnalysisQueueProcessor,
    StaticAnalyzerWorker,
    UrlAnalyzerWorker,
    AiAnalyzerWorker,
    SandboxExecutorWorker,
  ],
})
export class WorkersModule {}
