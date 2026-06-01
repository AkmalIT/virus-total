import { Injectable } from '@nestjs/common';

@Injectable()
export class ElasticService {
  // eslint-disable-next-line @typescript-eslint/require-await
  async indexAnalysisResult(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resultId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _document: Record<string, unknown>,
  ) {
    return {
      indexed: false,
      reason: 'Elasticsearch adapter is not configured yet',
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async searchResults(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _query: string,
  ) {
    return [];
  }
}
