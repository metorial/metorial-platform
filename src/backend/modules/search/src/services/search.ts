import { Service } from '@metorial/service';
import { Index } from 'meilisearch';
import { meiliSearch } from '../meilisearch';

export type SearchIndex = 'server_listing';

let indices = new Map<string, Index>();

class SearchService {
  async ensureIndex(index: SearchIndex) {
    if (!meiliSearch) return;

    if (indices.has(index)) return indices.get(index)!;

    let meiliIndex = meiliSearch.index(index);
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
    let index = await this.ensureIndex(d.index);
    if (!index) return [];

    let result = await index.search(d.query, {
      limit: d.options?.limit,

      filters: d.options?.filters
        ? Object.entries(d.options.filters).map(([key, value]) => `(${key} = "${value}")`)
        : undefined
    });

    return result.hits as T[];
  }
}

export let searchService = Service.create('searchService', () => new SearchService()).build();
