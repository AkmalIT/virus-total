import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisResultType, IocType, Severity } from '@prisma/client';
import * as Minio from 'minio';
import { NtExecutable } from 'pe-library';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { PrismaService } from '../infra/db/prisma.service';
import { IocsService } from '../modules/iocs/iocs.service';
import { ResultsService } from '../modules/results/results.service';

const SUSPICIOUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.ps1', '.js', '.vbs', '.hta', '.scr',
  '.pif', '.cmd', '.com', '.msi', '.jar', '.py', '.rb', '.sh',
]);

const DANGEROUS_IMPORTS = new Set([
  'CreateRemoteThread', 'VirtualAllocEx', 'WriteProcessMemory',
  'NtUnmapViewOfSection', 'SetWindowsHookEx', 'GetAsyncKeyState',
  'CryptEncrypt', 'InternetOpen', 'URLDownloadToFile',
  'ShellExecute', 'WinExec', 'CreateService', 'RegSetValueEx',
]);

@Injectable()
export class StaticAnalyzerWorker {
  private readonly minioClient: Minio.Client | null;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
    private readonly iocsService: IocsService,
  ) {
    const endpoint = config.get<string>('MINIO_ENDPOINT');
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'virustotal';

    this.minioClient = endpoint
      ? new Minio.Client({
          endPoint: endpoint,
          port: Number(config.get<string>('MINIO_PORT') ?? 9000),
          useSSL: config.get<string>('MINIO_USE_SSL') === 'true',
          accessKey: config.get<string>('MINIO_ACCESS_KEY')!,
          secretKey: config.get<string>('MINIO_SECRET_KEY')!,
        })
      : null;
  }

  async handle(payload: AnalysisJobPayload) {
    const submission = await this.prisma.submission.findUniqueOrThrow({
      where: { id: payload.submissionId },
    });

    const findings: string[] = [];
    let riskScore = 0;
    let peImports: string[] = [];

    const ext = this.getExtension(submission.file_name ?? '');
    const hasDoubleExtension = this.checkDoubleExtension(submission.file_name ?? '');

    if (SUSPICIOUS_EXTENSIONS.has(ext)) {
      findings.push(`suspicious extension: ${ext}`);
      riskScore += 25;
    }

    if (hasDoubleExtension) {
      findings.push(`double extension detected: ${submission.file_name}`);
      riskScore += 30;
    }

    if (submission.sha256) {
      await this.iocsService.create({
        submission_id: payload.submissionId,
        type: IocType.hash,
        value: submission.sha256,
        confidence: 1.0,
      });
    }

    if (submission.storage_key && this.minioClient) {
      let buffer: Buffer | null = null;
      try {
        buffer = await this.downloadToBuffer(submission.storage_key);
      } catch {
        findings.push('file download from storage failed (storage unavailable)');
      }

      if (buffer) {
        const entropy = this.calculateEntropy(buffer);
        if (entropy > 7.0) {
          findings.push(`high entropy: ${entropy.toFixed(2)} (packed or encrypted)`);
          riskScore += 20;
        } else if (entropy > 6.0) {
          findings.push(`elevated entropy: ${entropy.toFixed(2)}`);
          riskScore += 10;
        }

        if (this.isPeFile(buffer)) {
          try {
            peImports = this.extractPeImports(buffer);
            const dangerousFound = peImports.filter((imp) => DANGEROUS_IMPORTS.has(imp));
            if (dangerousFound.length > 0) {
              findings.push(`dangerous PE imports: ${dangerousFound.join(', ')}`);
              riskScore += Math.min(dangerousFound.length * 8, 40);
            }
          } catch {
            findings.push('PE parsing failed (possibly obfuscated)');
            riskScore += 10;
          }
        }
      }
    } else if (submission.storage_key && !this.minioClient) {
      findings.push('storage not configured — binary analysis skipped');
    }

    riskScore = Math.min(riskScore, 100);

    const severity = this.scoreToSeverity(riskScore);

    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.static_report,
      severity,
      score: riskScore / 100,
      data: {
        riskScore,
        severity,
        findings,
        metadata: {
          filename: submission.file_name,
          extension: ext,
          mimeType: submission.mime_type,
          sizeBytes: submission.size_bytes ? Number(submission.size_bytes) : null,
          sha256: submission.sha256,
        },
        peImports: peImports.length > 0 ? peImports : undefined,
      },
    });
  }

  private async downloadToBuffer(storageKey: string): Promise<Buffer> {
    const stream = await this.minioClient!.getObject(this.bucket, storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  private calculateEntropy(buf: Buffer): number {
    const freq = new Array<number>(256).fill(0);
    for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
    let entropy = 0;
    for (const f of freq) {
      if (f === 0) continue;
      const p = f / buf.length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private isPeFile(buf: Buffer): boolean {
    if (buf.length < 64) return false;
    if (buf[0] !== 0x4d || buf[1] !== 0x5a) return false; // MZ header
    const peOffset = buf.readUInt32LE(0x3c);
    if (peOffset + 4 > buf.length) return false;
    return buf.readUInt32LE(peOffset) === 0x00004550; // PE\0\0
  }

  private extractPeImports(buf: Buffer): string[] {
    const exe = NtExecutable.from(buf);
    const imports: string[] = [];

    for (const section of exe.getAllSections()) {
      const data = section.data;
      if (!data) continue;

      // Extract readable strings that match known imports
      const text = Buffer.from(data).toString('binary');
      for (const name of DANGEROUS_IMPORTS) {
        if (text.includes(name)) imports.push(name);
      }
    }

    return [...new Set(imports)];
  }

  private getExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  private checkDoubleExtension(filename: string): boolean {
    const parts = filename.toLowerCase().split('.');
    if (parts.length < 3) return false;
    const secondToLast = `.${parts[parts.length - 2]}`;
    return SUSPICIOUS_EXTENSIONS.has(secondToLast);
  }

  private scoreToSeverity(score: number): Severity {
    if (score >= 75) return Severity.critical;
    if (score >= 55) return Severity.high;
    if (score >= 35) return Severity.medium;
    if (score >= 15) return Severity.low;
    return Severity.info;
  }
}
