import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as Minio from 'minio';
import { AppLogger } from '../../common/logging/app-logger.service';

type UploadSubmissionStreamInput = {
  userId: string;
  fileName: string;
  mimeType?: string;
  stream: Readable;
};

export type UploadedArtifact = {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
};

@Injectable()
export class StorageService {
  private readonly client: Minio.Client | null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.client = this.isConfigured() ? this.createClient() : null;
  }

  buildSubmissionObjectKey(userId: string, filename: string) {
    const safeFilename = filename.replace(/[^\w.-]/g, '_');

    return `submissions/${userId}/${randomUUID()}-${safeFilename}`;
  }

  async uploadSubmissionStream(
    input: UploadSubmissionStreamInput,
  ): Promise<UploadedArtifact> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Object storage is not configured. Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET.',
      );
    }

    const storageKey = this.buildSubmissionObjectKey(
      input.userId,
      input.fileName,
    );
    const hash = createHash('sha256');
    let sizeBytes = 0;

    const hasher = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        sizeBytes += chunk.length;
        callback(null, chunk);
      },
    });

    const uploadPromise = this.client.putObject(
      this.bucketName(),
      storageKey,
      hasher,
      undefined,
      {
        'Content-Type': input.mimeType ?? 'application/octet-stream',
      },
    );

    try {
      await pipeline(input.stream, hasher);
      await uploadPromise;
    } catch (error) {
      this.logger.error(
        'Artifact upload failed',
        error instanceof Error ? error.stack : undefined,
        StorageService.name,
        {
          eventType: 'storage.upload.failed',
          storageKey,
        },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Artifact upload failed',
      );
    }

    const artifact = {
      storageKey,
      sha256: hash.digest('hex'),
      sizeBytes,
    };

    this.logger.event(
      'storage.upload.completed',
      'Artifact uploaded to object storage',
      StorageService.name,
      {
        storageKey,
        sizeBytes,
        sha256: artifact.sha256,
      },
    );

    return artifact;
  }

  private isConfigured() {
    return Boolean(
      this.config.get<string>('MINIO_ENDPOINT') &&
      this.config.get<string>('MINIO_ACCESS_KEY') &&
      this.config.get<string>('MINIO_SECRET_KEY') &&
      this.config.get<string>('MINIO_BUCKET'),
    );
  }

  private createClient() {
    const port = Number(this.config.get<string>('MINIO_PORT') ?? '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';

    return new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT')!,
      port: Number.isFinite(port) ? port : 9000,
      useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY')!,
      secretKey: this.config.get<string>('MINIO_SECRET_KEY')!,
    });
  }

  private bucketName() {
    return this.config.get<string>('MINIO_BUCKET')!;
  }
}
