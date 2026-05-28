import { Injectable } from '@nestjs/common';

@Injectable()
export class ElasticService {
  async indexAnalysisResult(
    _resultId: string,
    _document: Record<string, unknown>,
  ) {
    return {
      indexed: false,
      reason: 'Elasticsearch adapter is not configured yet',
    };
  }

  async searchResults(_query: string) {
    return [];
  }
}
