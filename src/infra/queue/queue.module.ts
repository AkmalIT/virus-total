import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalysisQueueService } from './analysis-queue.service';
import { ANALYSIS_DLQ, ANALYSIS_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: configService.get<string>('REDIS_URL')
          ? { url: configService.get<string>('REDIS_URL') }
          : {
              host: configService.get<string>('REDIS_HOST') ?? 'localhost',
              port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
            },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue({
      name: ANALYSIS_QUEUE,
    }),
    BullModule.registerQueue({
      name: ANALYSIS_DLQ,
    }),
  ],
  providers: [AnalysisQueueService],
  exports: [BullModule, AnalysisQueueService],
})
export class QueueModule {}
