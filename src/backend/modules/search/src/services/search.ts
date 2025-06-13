import { Service } from '@metorial/service';
import { Index, MeiliSearchApiError } from 'meilisearch';
import { env } from '../env';
import { meiliSearch } from '../meilisearch';

export type SearchIndex = 'server_listing';

let indices = new Map<string, Index>();

let prefix = env.meiliSearch.MEILISEARCH_INDEX_PREFIX;

class SearchService {
  private async ensureIndex(index: SearchIndex) {
    if (!meiliSearch) return;

    if (indices.has(index)) return indices.get(index)!;

    let meiliIndex = meiliSearch.index(prefix ? `${prefix}_${index}` : index);
    indices.set(index, meiliIndex);

    return meiliIndex;
  }

  async indexDocument<T extends { id: string }>(d: { index: SearchIndex; document: T | T[] }) {
    let index = await this.ensureIndex(d.index);
    if (!index) return;

    await index.addDocuments(Array.isArray(d.document) ? d.document : [d.document], {
      primaryKey: 'id'
    });
  }

  async search<T>(d: {
    index: SearchIndex;
    query: string;
    options?: {
      limit?: number;
      filters?: Record<string, { $eq: string }>;
    };
  }) {
    try {
      let index = await this.ensureIndex(d.index);
      if (!index) return [];

      let result = await index.search(d.query, {
        limit: d.options?.limit,

        filters: d.options?.filters
          ? Object.entries(d.options.filters).map(([key, value]) => `(${key} = "${value}")`)
          : undefined
      });

      return result.hits as T[];
    } catch (error: any) {
      if (error instanceof MeiliSearchApiError) {
        if (error.cause?.code == 'index_not_found') {
          // We have not created any document in this index yet
          return [];
        }
      }

      throw error;
    }
  }
}

export let searchService = Service.create('searchService', () => new SearchService()).build();
