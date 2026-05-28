import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/db/prisma.module';
import { IocsController } from './iocs.controller';
import { IocsService } from './iocs.service';

@Module({
  imports: [PrismaModule],
  controllers: [IocsController],
  providers: [IocsService],
  exports: [IocsService],
})
export class IocsModule {}
