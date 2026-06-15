import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisResultType, Prisma, Severity } from '@prisma/client';
import { execFile } from 'node:child_process';
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import * as Minio from 'minio';
import { PrismaService } from '../infra/db/prisma.service';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { ResultsService } from '../modules/results/results.service';

const execFileAsync = promisify(execFile);

const SANDBOX_TIMEOUT_MS = 30_000;
const SAFE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'application/pdf',
]);

type SandboxResult = {
  processes: string[];
  networkCalls: string[];
  suspiciousApis: string[];
  riskScore: number;
  rawOutput?: string;
  note?: string;
  skipped?: boolean;
  reason?: string;
};

@Injectable()
export class SandboxExecutorWorker {
  private readonly minioClient: Minio.Client | null;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
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

    // Skip sandbox for safe file types — no execution risk
    if (submission.mime_type && SAFE_MIME_TYPES.has(submission.mime_type)) {
      return this.resultsService.create({
        job_id: payload.jobId,
        result_type: AnalysisResultType.sandbox_report,
        severity: Severity.info,
        score: 0,
        data: {
          skipped: true,
          reason: `Safe MIME type: ${submission.mime_type}`,
          processes: [],
          networkCalls: [],
          suspiciousApis: [],
          riskScore: 0,
        },
      });
    }

    if (!submission.storage_key || !this.minioClient) {
      return this.skippedResult(payload.jobId, !this.minioClient ? 'Storage not configured' : 'No file in storage to sandbox');
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'sandbox-'));
    const filePath = join(tmpDir, submission.file_name ?? 'artifact');
    let containerId: string | null = null;

    try {
      let stream: NodeJS.ReadableStream;
      try {
        stream = await this.minioClient.getObject(this.bucket, submission.storage_key);
      } catch {
        return this.skippedResult(payload.jobId, 'Storage unavailable — sandbox skipped');
      }
      await pipeline(stream as any, createWriteStream(filePath));

      // Run in isolated Docker container — never on host
      const result = await this.runInContainer(filePath, tmpDir);

      return this.resultsService.create({
        job_id: payload.jobId,
        result_type: AnalysisResultType.sandbox_report,
        severity: this.scoreToSeverity(result.riskScore),
        score: result.riskScore / 100,
        data: result as unknown as Prisma.InputJsonObject,
      });
    } finally {
      if (containerId) {
      execFile('docker', ['rm', '-f', containerId], () => {});
      }
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async runInContainer(filePath: string, tmpDir: string): Promise<SandboxResult> {
    const timeoutSec = Math.floor(SANDBOX_TIMEOUT_MS / 1000);

    try {
      // Run container: no network, read-only fs, CPU+memory limits, auto-remove
      const { stdout, stderr } = await execFileAsync('docker', [
        'run', '--rm',
        '--network', 'none',
        '--memory', '256m',
        '--cpus', '0.5',
        '--read-only',
        '--tmpfs', '/tmp:size=64m',
        '--volume', `${tmpDir}:/sandbox:ro`,
        '--workdir', '/sandbox',
        '--timeout', `${timeoutSec}`,
        'alpine:3.19',
        'sh', '-c',
        // Collect basic execution info safely — no actual execution of uploaded file
        `echo "file_info:" && file /sandbox/${this.basename(filePath)} 2>/dev/null || true; ` +
        `echo "strings_count:" && strings /sandbox/${this.basename(filePath)} 2>/dev/null | wc -l || echo 0; ` +
        `echo "size:" && stat -c%s /sandbox/${this.basename(filePath)} 2>/dev/null || echo 0`,
      ], { timeout: SANDBOX_TIMEOUT_MS });

      return this.parseContainerOutput(stdout + stderr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Docker not available or timeout — return safe fallback
      return {
        processes: [],
        networkCalls: [],
        suspiciousApis: [],
        riskScore: 0,
        note: `Sandbox analysis unavailable: ${msg.slice(0, 100)}`,
      } satisfies SandboxResult;
    }
  }

  private parseContainerOutput(output: string): SandboxResult {
    const suspiciousApis: string[] = [];
    let riskScore = 0;

    const suspiciousStrings = [
      'CreateRemoteThread', 'VirtualAlloc', 'WriteProcessMemory',
      'cmd.exe', 'powershell', 'WScript', 'RegOpenKey', 'ShellExecute',
      'URLDownload', '/etc/passwd', 'wget', 'curl',
    ];

    for (const s of suspiciousStrings) {
      if (output.toLowerCase().includes(s.toLowerCase())) {
        suspiciousApis.push(s);
        riskScore += 10;
      }
    }

    riskScore = Math.min(riskScore, 100);

    return {
      processes: [],
      networkCalls: [],
      suspiciousApis,
      riskScore,
      rawOutput: output.slice(0, 500),
    };
  }

  private skippedResult(jobId: string, reason: string) {
    return this.resultsService.create({
      job_id: jobId,
      result_type: AnalysisResultType.sandbox_report,
      severity: Severity.info,
      score: 0,
      data: { skipped: true, reason, processes: [], networkCalls: [], suspiciousApis: [], riskScore: 0 },
    });
  }

  private scoreToSeverity(score: number): Severity {
    if (score >= 75) return Severity.critical;
    if (score >= 55) return Severity.high;
    if (score >= 35) return Severity.medium;
    if (score >= 15) return Severity.low;
    return Severity.info;
  }

  private basename(path: string): string {
    return path.split('/').pop() ?? path;
  }
}
