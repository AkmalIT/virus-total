import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { WorkersModule } from './workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WorkersModule,
  ],
})
class WorkerAppModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerAppModule);
}

void bootstrap();
