import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/db/prisma.module';
import { QueueModule } from '../../infra/queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [PrismaModule, QueueModule, NotificationsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
