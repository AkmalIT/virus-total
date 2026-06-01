import { BadRequestException } from '@nestjs/common';
import Busboy from 'busboy';
import { Readable } from 'node:stream';
import { Request } from 'express';

export type ParsedMultipartUpload = {
  stream: Readable;
  fileName: string;
  mimeType: string;
  fields: Record<string, string>;
};

export function parseMultipartUpload(
  request: Request,
): Promise<ParsedMultipartUpload> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
      },
    });
    const fields: Record<string, string> = {};
    let settled = false;

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (_fieldName, stream, info) => {
      if (settled) {
        stream.resume();
        return;
      }

      settled = true;
      resolve({
        stream,
        fileName: info.filename || 'upload.bin',
        mimeType: info.mimeType || 'application/octet-stream',
        fields,
      });
    });

    busboy.on('error', (error) => {
      reject(
        new BadRequestException(
          error instanceof Error ? error.message : 'Invalid multipart upload',
        ),
      );
    });

    busboy.on('finish', () => {
      if (!settled) {
        reject(new BadRequestException('file field is required'));
      }
    });

    request.pipe(busboy);
  });
}
