import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisResultType, IocType, Prisma, Severity } from '@prisma/client';
import { PrismaService } from '../infra/db/prisma.service';
import { AnalysisJobPayload } from '../infra/queue/queue.constants';
import { IocsService } from '../modules/iocs/iocs.service';
import { ResultsService } from '../modules/results/results.service';

// Known malicious / suspicious TLDs and patterns
const SUSPICIOUS_TLDS = new Set(['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.work', '.click', '.download', '.zip', '.mov']);
const SUSPICIOUS_KEYWORDS = ['phish', 'login', 'secure', 'verify', 'account', 'update', 'banking', 'paypal', 'amazon', 'apple', 'microsoft', 'free', 'win', 'prize', 'crack', 'keygen', 'warez', 'torrent', 'pirat', 'igruha', 'igr'];
const IP_URL_REGEX = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/;
const EXCESSIVE_SUBDOMAINS_REGEX = /^https?:\/\/([^/]+\.){4,}/;
const PORT_IN_URL_REGEX = /^https?:\/\/[^/]+:\d+/;

type UrlScanResult = {
  url: string;
  domain: string;
  riskScore: number;
  severity: string;
  findings: string[];
  safeBrowsing: { checked: boolean; threats: string[] };
  heuristics: Record<string, unknown>;
};

@Injectable()
export class UrlAnalyzerWorker {
  private readonly safeBrowsingKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
    private readonly iocsService: IocsService,
  ) {
    const key = config.get<string>('SAFE_BROWSING_API_KEY');
    this.safeBrowsingKey = key && !key.startsWith('your-') ? key : null;
  }

  async handle(payload: AnalysisJobPayload) {
    const submission = await this.prisma.submission.findUniqueOrThrow({
      where: { id: payload.submissionId },
    });

    const url = submission.url ?? '';
    const result = await this.analyzeUrl(url);

    // Save URL and domain as IOCs
    await this.iocsService.create({
      submission_id: payload.submissionId,
      type: IocType.url,
      value: url,
      confidence: result.riskScore / 100,
    });

    try {
      const domain = new URL(url).hostname;
      await this.iocsService.create({
        submission_id: payload.submissionId,
        type: IocType.domain,
        value: domain,
        confidence: result.riskScore / 100,
      });
    } catch { /* invalid url */ }

    return this.resultsService.create({
      job_id: payload.jobId,
      result_type: AnalysisResultType.reputation,
      severity: this.scoreToSeverity(result.riskScore),
      score: result.riskScore / 100,
      data: result as unknown as Prisma.InputJsonObject,
    });
  }

  private async analyzeUrl(url: string): Promise<UrlScanResult> {
    const findings: string[] = [];
    let riskScore = 0;
    let domain = '';

    try {
      const parsed = new URL(url);
      domain = parsed.hostname;

      // HTTP (not HTTPS)
      if (parsed.protocol === 'http:') {
        findings.push('non-HTTPS connection');
        riskScore += 10;
      }

      // IP address as host
      if (IP_URL_REGEX.test(url)) {
        findings.push('IP address used as host (no domain)');
        riskScore += 25;
      }

      // Suspicious TLD
      const tld = '.' + domain.split('.').pop();
      if (SUSPICIOUS_TLDS.has(tld)) {
        findings.push(`suspicious TLD: ${tld}`);
        riskScore += 20;
      }

      // Excessive subdomains (e.g. paypal.secure.login.evil.com)
      if (EXCESSIVE_SUBDOMAINS_REGEX.test(url)) {
        findings.push('excessive subdomain depth (possible phishing)');
        riskScore += 20;
      }

      // Non-standard port
      if (PORT_IN_URL_REGEX.test(url) && parsed.port !== '443' && parsed.port !== '80') {
        findings.push(`non-standard port: ${parsed.port}`);
        riskScore += 15;
      }

      // Suspicious keywords in domain or path
      const urlLower = url.toLowerCase();
      const matchedKeywords = SUSPICIOUS_KEYWORDS.filter((kw) => urlLower.includes(kw));
      if (matchedKeywords.length > 0) {
        findings.push(`suspicious keywords: ${matchedKeywords.join(', ')}`);
        riskScore += Math.min(matchedKeywords.length * 10, 30);
      }

      // Long URL (obfuscation indicator)
      if (url.length > 200) {
        findings.push(`unusually long URL: ${url.length} chars`);
        riskScore += 10;
      }

      // URL encoding abuse
      if ((url.match(/%[0-9a-f]{2}/gi) ?? []).length > 5) {
        findings.push('excessive URL encoding (possible obfuscation)');
        riskScore += 15;
      }
    } catch {
      findings.push('invalid or malformed URL');
      riskScore += 30;
    }

    // Google Safe Browsing
    const safeBrowsing = await this.checkSafeBrowsing(url);
    if (safeBrowsing.threats.length > 0) {
      findings.push(`Google Safe Browsing: ${safeBrowsing.threats.join(', ')}`);
      riskScore += 50;
    }

    riskScore = Math.min(riskScore, 100);

    return {
      url,
      domain,
      riskScore,
      severity: this.scoreToSeverity(riskScore),
      findings,
      safeBrowsing,
      heuristics: {
        ipAsHost: IP_URL_REGEX.test(url),
        isHttps: url.startsWith('https://'),
        urlLength: url.length,
      },
    };
  }

  private async checkSafeBrowsing(url: string): Promise<{ checked: boolean; threats: string[] }> {
    if (!this.safeBrowsingKey) {
      return { checked: false, threats: [] };
    }

    try {
      const res = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.safeBrowsingKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'virustotal-clone', clientVersion: '1.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url }],
            },
          }),
        },
      );

      const data = await res.json() as { matches?: { threatType: string }[] };
      const threats = (data.matches ?? []).map((m) => m.threatType);
      return { checked: true, threats };
    } catch {
      return { checked: false, threats: [] };
    }
  }

  private scoreToSeverity(score: number): Severity {
    if (score >= 75) return Severity.critical;
    if (score >= 55) return Severity.high;
    if (score >= 35) return Severity.medium;
    if (score >= 15) return Severity.low;
    return Severity.info;
  }
}
