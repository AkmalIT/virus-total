import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationMiddleware } from './common/logging/correlation.middleware';
import { LoggingModule } from './common/logging/logging.module';
import { StorageModule } from './infra/storage/storage.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { AuthModule } from './modules/auth/auth.module';
import { IocsModule } from './modules/iocs/iocs.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { JobsRecoveryScheduler } from './modules/jobs/jobs-recovery.scheduler';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ResultsModule } from './modules/results/results.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    LoggingModule,
    StorageModule,
    AuthModule,
    UsersModule,
    SubmissionsModule,
    AnalysisModule,
    IocsModule,
    JobsModule,
    ResultsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, JobsRecoveryScheduler],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
