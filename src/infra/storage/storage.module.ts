import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../../common/logging/logging.module';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
