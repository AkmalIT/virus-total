import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/db/prisma.module';
import { ElasticModule } from '../../infra/elastic/elastic.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [PrismaModule, ElasticModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
