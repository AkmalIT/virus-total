import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StorageService {
  buildSubmissionObjectKey(userId: string, filename: string) {
    const safeFilename = filename.replace(/[^\w.-]/g, '_');

    return `submissions/${userId}/${randomUUID()}-${safeFilename}`;
  }
}
