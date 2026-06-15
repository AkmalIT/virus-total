import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisResultType, Prisma, Severity } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../infra/db/prisma.service';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { ResultsService } from '../modules/results/results.service';

@Injectable()
export class AiAnalyzerWorker {
  private readonly gemini: GoogleGenerativeAI | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
  ) {
    const apiKey = config.get<string>('GEMINI_API_KEY');
    this.gemini = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async handle(payload: AnalysisJobPayload) {
    const staticResult = await this.prisma.analysisResult.findFirst({
      where: {
        job: { submission_id: payload.submissionId },
        result_type: AnalysisResultType.static_report,
      },
    });

    const staticData = staticResult?.data as Record<string, unknown> | null;
    const riskScore = (staticData?.riskScore as number) ?? 0;
    const findings = (staticData?.findings as string[]) ?? [];
    const metadata = (staticData?.metadata as Record<string, unknown>) ?? {};

    const summary = await this.generateSummary({ riskScore, findings, metadata });

    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.ai_summary,
      severity: staticResult?.severity ?? Severity.info,
      score: staticResult?.score ?? null,
      data: summary as Prisma.InputJsonObject,
    });
  }

  private async generateSummary(input: {
    riskScore: number;
    findings: string[];
    metadata: Record<string, unknown>;
  }) {
    if (!this.gemini) {
      return this.fallbackSummary(input);
    }

    const prompt = `You are a malware analyst. Analyze these static analysis results and respond in JSON only, no markdown.

File: ${input.metadata.filename ?? 'unknown'}
MIME: ${input.metadata.mimeType ?? 'unknown'}
Size: ${input.metadata.sizeBytes ?? 'unknown'} bytes
SHA256: ${input.metadata.sha256 ?? 'unknown'}
Risk Score: ${input.riskScore}/100
Findings:
${input.findings.length > 0 ? input.findings.map((f) => `- ${f}`).join('\n') : '- No suspicious findings'}

Respond with this exact JSON:
{
  "summary": "<2-3 sentence plain-language explanation>",
  "riskLevel": "<safe|low|medium|high|critical>",
  "recommendation": "<one actionable sentence>",
  "riskScore": ${input.riskScore}
}`;

    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/^```json|^```|```$/gm, '').trim();
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return this.fallbackSummary(input);
    }
  }

  private fallbackSummary(input: {
    riskScore: number;
    findings: string[];
  }): Record<string, unknown> {
    const riskLevel =
      input.riskScore >= 75 ? 'critical'
      : input.riskScore >= 55 ? 'high'
      : input.riskScore >= 35 ? 'medium'
      : input.riskScore >= 15 ? 'low'
      : 'safe';

    const findingsSummary =
      input.findings.length > 0
        ? `Detected: ${input.findings.join('; ')}.`
        : 'No suspicious characteristics detected.';

    return {
      summary: `Static analysis assigned a risk score of ${input.riskScore}/100. ${findingsSummary}`,
      riskLevel,
      recommendation:
        input.riskScore >= 55
          ? 'Do not execute this file. Treat it as malicious.'
          : input.riskScore >= 35
            ? 'Exercise caution. Review findings before executing.'
            : 'File appears low-risk based on static indicators.',
      riskScore: input.riskScore,
    };
  }
}
