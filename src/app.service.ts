import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'analysis-pipeline-api',
      status: 'ok',
      architecture: 'modular-monolith',
    };
  }
}
